import{fit,simulate,teamsOf}from'./engine.js';
self.onmessage=({data})=>{try{let model=fit(data.matches,teamsOf(data.matches),data.penalty);let stats=simulate(data.matches,model,data.options,p=>self.postMessage({progress:p}));self.postMessage({model,stats});}catch(e){self.postMessage({error:e.message});}};
