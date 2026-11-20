#!/usr/bin/env python3
import datetime,json,re,secrets,subprocess,tempfile,threading,mimetypes,shutil
import runtime
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse,parse_qs
ROOT=Path(__file__).resolve().parent
GEOMETRY=None
NAMES={o['name'] for o in json.loads((ROOT/'web/catalog.json').read_text())['objects']}
LOCK=threading.Lock();SETTINGS_LOCK=threading.Lock();TOKEN=secrets.token_urlsafe(32)
DATA_DIR=ROOT;EXPORT_DIR=ROOT
EXTENSIONS={'.png','.glb','.csv','.json','.blend'}
def set_directory(path):
    global EXPORT_DIR
    target=Path(path).expanduser()
    if not target.is_absolute():raise ValueError('Choose an absolute folder path.')
    target.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target,prefix='.worm-write-check-'):pass
    with SETTINGS_LOCK:
        runtime.update_settings(DATA_DIR,{'export_directory':str(target)})
        EXPORT_DIR=target
    return target

def validate_filename(name):
    if (not isinstance(name,str) or not name or len(name)>150 or name.startswith('.')
        or name.endswith((' ','.')) or re.search(r'[\\/:<>"|?*\x00-\x1f\x7f]',name)
        or Path(name).name!=name or Path(name).suffix not in EXTENSIONS
        or name.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*[f'COM{i}' for i in range(1,10)],*[f'LPT{i}' for i in range(1,10)]}):
        raise ValueError('Invalid export filename. Avoid reserved names and these characters: < > : " / \\ | ? *')
    return name

def save_unique(name,raw,destination=None):
    validate_filename(name)
    destination=destination or EXPORT_DIR
    for n in range(100000):
        candidate=destination/(name if n==0 else f'{Path(name).stem}_{n}{Path(name).suffix}')
        try:
            with candidate.open('xb') as f:f.write(raw)
            return candidate
        except FileExistsError:continue
    raise RuntimeError('Unable to allocate export filename.')

def model_status():
    settings=runtime.read_settings(DATA_DIR)
    blender=runtime.resolve_blender(settings);model=runtime.resolve_model(settings,DATA_DIR)
    return {'blender_path':str(blender) if blender else settings.get('blender_path',''),
            'model_path':str(model) if model else settings.get('model_path',''),
            'blender_available':bool(blender),'model_available':bool(model)}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT/'web'),**kw)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','no-store');super().end_headers()
    def reply(self,status,data):
        raw=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def valid_host(self):
        return self.headers.get('Host') in {'127.0.0.1:'+str(self.server.server_port),'localhost:'+str(self.server.server_port)}
    def do_GET(self):
        if not self.valid_host():self.reply(403,{'error':'Local app requests only.'});return
        path=urlparse(self.path).path
        if path=='/api/settings':self.reply(200,{'export_directory':str(EXPORT_DIR),'token':TOKEN,**model_status()});return
        if path=='/model.bin':
            self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Content-Length',str(GEOMETRY.stat().st_size));self.end_headers()
            with GEOMETRY.open('rb') as stream:shutil.copyfileobj(stream,self.wfile)
            return
        if path.startswith('/api/'):self.reply(404,{'error':'Unknown endpoint'});return
        super().do_GET()
    def do_POST(self):
        if not self.valid_host():self.reply(403,{'error':'Local app requests only.'});return
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+self.headers.get('Host',''):self.reply(403,{'error':'Local app requests only.'});return
        if self.headers.get('X-Worm-Token')!=TOKEN:self.reply(403,{'error':'App session expired. Reopen the app.'});return
        try:
            size=int(self.headers.get('Content-Length',0))
            if not 0<size<=150*1024*1024:raise ValueError('Invalid export size (maximum 150 MB).')
            raw=self.rfile.read(size);path=urlparse(self.path).path
            if path=='/api/model-config':
                data=json.loads(raw);changes={}
                for key in ['blender_path','model_path']:
                    value=data.get(key,'')
                    if not isinstance(value,str):raise ValueError('Paths must be text.')
                    if value.strip():
                        candidate=Path(value.strip()).expanduser()
                        if not candidate.is_absolute() or not candidate.exists():raise ValueError('Path not found: '+str(candidate))
                        if key=='model_path' and not candidate.is_file():raise ValueError('Choose the .blend file itself.')
                        if key=='blender_path' and not (candidate.is_file() or (candidate.suffix.lower()=='.app' and (candidate/'Contents/MacOS/Blender').is_file())):raise ValueError('Choose the Blender executable or macOS Blender.app.')
                        changes[key]=str(candidate)
                    else:changes[key]=''
                with SETTINGS_LOCK:runtime.update_settings(DATA_DIR,changes)
                self.reply(200,model_status());return
            if path=='/api/settings':
                data=json.loads(raw);target=set_directory(data['export_directory']);self.reply(200,{'export_directory':str(target)});return
            if path=='/api/save':
                name=parse_qs(urlparse(self.path).query).get('name',[''])[0]
                target=save_unique(name,raw);self.reply(200,{'path':str(target),'filename':target.name});return
            if path=='/api/export-blend':
                data=json.loads(raw);names=data.get('names')
                if not isinstance(names,list) or not names or any(not isinstance(n,str) or n not in NAMES for n in names):raise ValueError('Choose valid model objects.')
                names=list(dict.fromkeys(names))
                colors=data.get('colors',{})
                if not isinstance(colors,dict) or any(n not in names or not isinstance(c,str) or not re.fullmatch(r'[0-9a-fA-F]{6}',c) for n,c in colors.items()):raise ValueError('Invalid per-cell colors.')
                if not LOCK.acquire(False):self.reply(409,{'error':'Another extraction is running.'});return
                try:
                    config=runtime.read_settings(DATA_DIR);blender=runtime.resolve_blender(config);model=runtime.resolve_model(config,DATA_DIR)
                    if not model:raise ValueError('Download the February 2012 original .blend from the Virtual Worm site, then configure its local path in Model & Blender setup.')
                    if not blender:raise ValueError('Configure a Blender executable in Model & Blender setup. PNG, GLB and CSV work without Blender.')
                    filename=data.get('filename') or 'cells_'+datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')+'.blend';destination=EXPORT_DIR
                    validate_filename(filename)
                    if not filename.endswith('.blend'):raise ValueError('Use a .blend filename.')
                    with tempfile.TemporaryDirectory(prefix='worm-') as tmp:
                        job=Path(tmp)/'job.json';output=Path(tmp)/filename;job.write_text(json.dumps({'names':names,'colors':colors,'output':str(output),'source':str(model)}))
                        result=subprocess.run([str(blender),'-b','-t','2','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',str(ROOT/'export_blend.py'),'--',str(job)],capture_output=True,text=True,timeout=180)
                        if result.returncode or not output.is_file():
                            (DATA_DIR/'last-error.log').write_text(result.stdout+'\n'+result.stderr);raise RuntimeError('Blender extraction failed. See last-error.log in the app folder.')
                        target=save_unique(filename,output.read_bytes(),destination)
                    self.reply(200,{'path':str(target),'filename':target.name,'count':len(names)})
                finally:LOCK.release()
                return
            self.reply(404,{'error':'Unknown endpoint'})
        except (ValueError,KeyError,TypeError) as e:self.reply(400,{'error':str(e)})
        except Exception as e:self.reply(500,{'error':str(e)})
def create_server(data_dir,geometry,port=0):
    global DATA_DIR,EXPORT_DIR,GEOMETRY
    DATA_DIR=Path(data_dir).resolve();DATA_DIR.mkdir(parents=True,exist_ok=True);EXPORT_DIR=DATA_DIR;GEOMETRY=Path(geometry)
    settings=runtime.read_settings(DATA_DIR)
    if settings.get('export_directory'):
        target=Path(settings['export_directory']).expanduser()
        if not target.is_absolute():raise ValueError('Saved export folder must be an absolute path.')
        target.mkdir(parents=True,exist_ok=True);EXPORT_DIR=target
    else:set_directory(str(DATA_DIR))
    mimetypes.add_type('application/javascript','.js')
    return ThreadingHTTPServer(('127.0.0.1',port),Handler)

if __name__=='__main__':
    from launch import main
    raise SystemExit(main())
