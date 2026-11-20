// Calibration uses the original model's named 100um reference width.
export const DEFAULT_UM_PER_UNIT=100/0.9999656677246094;
export function unitFactor(unit,calibration){
 const factors={nm:0.001,um:1,mm:1000,model:calibration};
 if(!(unit in factors))throw Error('Choose a supported scale unit.');
 return factors[unit];
}
export function convertedLength(value,from,to,calibration){return value*unitFactor(from,calibration)/unitFactor(to,calibration);}
export function scaleBarLayout(config,view){
 const {length,unit,umPerUnit}=config;
 if(!Number.isFinite(length)||length<=0)throw Error('Scale length must be positive.');
 if(!Number.isFinite(umPerUnit)||umPerUnit<=0)throw Error('Calibration must be positive.');
 const worldLength=length*unitFactor(unit,umPerUnit)/umPerUnit;
 const pixels=worldLength*view.height*view.zoom/(view.top-view.bottom);
 if(!Number.isFinite(pixels)||pixels<2)throw Error('Scale bar is too small; increase its length or zoom in.');
 if(pixels>view.width*0.7)throw Error('Scale bar is too long; reduce its length or zoom out.');
 const symbols={nm:'nm',um:'µm',mm:'mm',model:'model units'};
 return {pixels,worldLength,label:Number(length.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6})+' '+symbols[unit]};
}
