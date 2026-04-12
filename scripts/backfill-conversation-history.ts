import container from '@soederpop/luca/agi'

async function backfill() {
    const h = container.feature('conversationHistory')                                     
    const all = await h.list()

    for (const m of all) {                                                                                                                              
      if (m.title === 'Untitled') {
	      try {
		const t = await h.generateTitle(m.id)                                                                                                           
		console.log('title:', m.id, t)                                                                                                                
	      } catch(e) {
	      }
      }                                                                                                                                                 
    }                                                                                                                                                   
    return `done: ${all.length} conversations`                                                                                                        
  }

await backfill()
