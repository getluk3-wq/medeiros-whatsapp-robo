const $=s=>document.querySelector(s);let session=null,offers=[],apiSecret='',searchPage=1,lastSearchKey='',seenProductIds=new Set();
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function msg(el,text,type=''){el.innerHTML=text?`<div class="${type}">${esc(text)}</div>`:''}
function userKey(suffix){return `mds_guest_${suffix}`}
function loadSettings(){ $('#appId').value=localStorage.getItem(userKey('appId'))||'';$('#affiliateId').value=localStorage.getItem(userKey('affiliateId'))||'';$('#secret').value='';apiSecret=''; }
function history(){try{return JSON.parse(localStorage.getItem(userKey('history'))||'[]')}catch{return []}}
function saveHistory(text){const h=history();h.unshift({text,date:new Date().toLocaleString('pt-BR')});localStorage.setItem(userKey('history'),JSON.stringify(h.slice(0,15)));renderHistory()}
function renderHistory(){const h=history();$('#history').innerHTML=h.length?h.map(x=>`<div class="history-item"><div class="muted">${esc(x.date)}</div>${esc(x.text)}</div>`).join(''):'<div class="empty">Suas divulgações copiadas ou abertas aparecerão aqui.</div>'}
// Plataforma aberta: sem cadastro, senha ou confirmação por e-mail.
$('#userEmail').textContent='Modo sem cadastro';
loadSettings();renderHistory();
$('#settingsBtn').onclick=()=>$('#settingsModal').classList.remove('hidden');$('#closeSettings').onclick=$('#closeSettings2').onclick=()=>$('#settingsModal').classList.add('hidden');
async function callApi(payload){const r=await fetch('/.netlify/functions/shopee-offers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});let d;try{d=await r.json()}catch{throw new Error('O servidor retornou uma resposta inválida. Confira a publicação no Netlify.')}if(!r.ok||d.ok===false)throw new Error((d.error||'Falha na API')+(d.code?` (código ${d.code})`:''));return d}
$('#testBtn').onclick=async()=>{const appId=$('#appId').value.trim(),secret=$('#secret').value.trim(),affiliateId=$('#affiliateId').value.trim();if(!appId||!secret){msg($('#apiResult'),'Informe o App ID e o Secret.','err');return}$('#testBtn').disabled=true;msg($('#apiResult'),'Testando conexão…');try{const d=await callApi({action:'test',appId,secret});apiSecret=secret;localStorage.setItem(userKey('appId'),appId);localStorage.setItem(userKey('affiliateId'),affiliateId);msg($('#apiResult'),d.message||'API conectada.','ok')}catch(e){msg($('#apiResult'),e.message,'err')}finally{$('#testBtn').disabled=false}};
$('#searchBtn').onclick=async()=>{const appId=$('#appId').value.trim()||localStorage.getItem(userKey('appId'))||'',secret=$('#secret').value.trim()||apiSecret,keyword=$('#keyword').value.trim(),category=$('#category').value,key=keyword+'|'+category;if(!appId||!secret){$('#settingsModal').classList.remove('hidden');msg($('#apiResult'),'Cadastre e teste suas credenciais antes de buscar.','err');return}if(key!==lastSearchKey){searchPage=1;seenProductIds=new Set();lastSearchKey=key;offers=[]}apiSecret=secret;$('#searchBtn').disabled=true;msg($('#status'),'Procurando novas ofertas e priorizando os melhores produtos…');try{const d=await callApi({action:'offers',appId,secret,keyword,category,page:searchPage,excludeIds:[...seenProductIds]});const fresh=(d.offers||[]).filter(o=>!seenProductIds.has(String(o.itemId||o.productId||o.productName)));fresh.forEach(o=>seenProductIds.add(String(o.itemId||o.productId||o.productName)));offers=fresh;searchPage=d.nextPage||searchPage+1;renderOffers();msg($('#status'),fresh.length?`Encontramos ${fresh.length} produto(s) novo(s), priorizando as melhores ofertas.`:'Não vieram produtos novos nesta página. Clique em buscar novamente para tentar outra página.',''+(fresh.length?'ok':'err'))}catch(e){msg($('#status'),e.message,'err')}finally{$('#searchBtn').disabled=false}};
function price(o){const p=Number(o.priceMin||o.priceMax||0);return p?`R$ ${p.toFixed(2).replace('.',',')}`:'Consulte o preço'}
const promoOpeners=[
 '🔥 OLHA ESSE ACHADINHO!', '🚨 OFERTA PRA CONFERIR!', '🛍️ MAIS UM ACHADO PRA SUA LISTA!',
 '👀 VOCÊ JÁ VIU ESSE PREÇO?', '💥 ACHAMOS UMA OFERTA INTERESSANTE!', '✨ DICA BOA DE COMPRA!',
 '🤩 ESSE PRODUTO MERECE SUA ATENÇÃO!', '📣 OLHA A OPORTUNIDADE DO DIA!',
 '🛒 ACHADINHO NOVO NA ÁREA!', '⚡ PRESTA ATENÇÃO NESSA OFERTA!'
];
const promoLines=[
 'Corre conferir os detalhes e veja se vale a pena pra você!',
 'Dá uma olhada nas avaliações e nas condições antes de comprar.',
 'Se estava procurando algo assim, vale abrir o link e conferir!',
 'Confira o preço atualizado, o frete e a disponibilidade no anúncio.',
 'Uma opção pra colocar na lista de desejos. Veja os detalhes!',
 'Entre no anúncio e confira se essa oferta combina com você!',
 'O preço e o estoque podem mudar; confira as condições no link.',
 'Achou útil? Abra o anúncio e veja todas as informações!'
];
const promoCtas=['👇 CONFIRA AQUI:','🔗 VEJA A OFERTA:','👉 ABRA O LINK E CONFIRA:','🛍️ OLHE OS DETALHES AQUI:','📲 ACESSE A OFERTA:','💥 CONFIRA ENQUANTO ESTÁ DISPONÍVEL:'];
const lastTemplateByProduct={};
let lastPromoSignature='';
function promoPriceBlock(o){
 const current=Number(o.priceMin||o.priceMax||0);
 const discount=Number(o.discountRate||0);
 if(!current) return discount>0?`🏷️ ${Math.round(discount)}% OFF informado pela oferta`:'💰 Confira o preço atualizado no link.';
 const money=n=>`R$ ${n.toFixed(2).replace('.',',')}`;
 // A API fornece o percentual de desconto, mas não um preço anterior explícito.
 // O preço anterior abaixo é uma estimativa matemática, não um preço histórico verificado.
 if(discount>0&&discount<100){
   const old=current/(1-discount/100);
   const saved=old-current;
   return `💥 ${Math.round(discount)}% OFF!\n💸 De aproximadamente ${money(old)} por ${money(current)}!\n💰 Economia estimada: ${money(saved)}!`;
 }
 return `💰 Por apenas ${money(current)}!`;
}
function promo(o){
 const name=o.productName||'Produto em oferta';
 const key=String(o.itemId||o.productId||name);
 let choices=promoOpeners.map((_,i)=>i).filter(i=>i!==lastTemplateByProduct[key]);
 if(!choices.length) choices=promoOpeners.map((_,i)=>i);
 const openerIndex=choices[Math.floor(Math.random()*choices.length)];
 lastTemplateByProduct[key]=openerIndex;
 const pick=(arr)=>arr[Math.floor(Math.random()*arr.length)];
 const link=o.affiliateLink||'';
 let text=`${promoOpeners[openerIndex]}\n\n📦 ${name}\n\n${promoPriceBlock(o)}\n\n${pick(promoLines)}\n\n${pick(promoCtas)}\n${link||'⚠️ Gere o link de afiliado antes de compartilhar.'}`;
 // Evita que o mesmo anúncio saia idêntico duas vezes seguidas.
 if(text===lastPromoSignature){text=text.replace(pick(promoLines),pick(promoLines));}
 lastPromoSignature=text;
 return text;
}
function renderOffers(){ $('#count').textContent=offers.length?`${offers.length} ofertas`:'';$('#offers').innerHTML=offers.length?offers.map((o,i)=>`<article class="offer">${o.imageUrl?`<img src="${esc(o.imageUrl)}" alt="Imagem do produto" loading="lazy">`:''}<span class="badge">${o.discountRate?Math.round(o.discountRate)+'% OFF':'OFERTA'}</span><h3>${esc(o.productName)}</h3><div class="price">${price(o)}</div><div class="meta">⭐ ${o.ratingStar||'—'} · 🛒 ${o.sales||0} vendas</div><div class="actions"><button class="link-btn" data-link="${i}">${o.affiliateLink?'Link pronto ✓':'Gerar link'}</button><button class="copy" data-copy="${i}">Copiar anúncio</button><button class="wa" data-wa="${i}">WhatsApp</button><button class="story-btn" data-story="${i}">📸 Instagram Story</button><button class="fb-btn" data-fb="${i}">👥 Grupo Facebook</button></div><div id="linkStatus${i}" class="small muted"></div></article>`).join(''):'<div class="empty">Nenhuma oferta nova encontrada. Clique em buscar novamente ou altere a categoria/palavra-chave.</div>'}

function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function loadPromoImage(url){return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;resolve(value)};if(!url){finish(null);return}const img=new Image();img.crossOrigin='anonymous';img.onload=()=>finish(img);img.onerror=()=>finish(null);try{img.src='/.netlify/functions/product-image?url='+encodeURIComponent(url)}catch{finish(null)}setTimeout(()=>finish(null),4500)})}
function canvasPromo(o,img=null){const c=document.createElement('canvas');c.width=720;c.height=1280;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,720,1280);g.addColorStop(0,'#111827');g.addColorStop(.55,'#273449');g.addColorStop(1,'#7c2d12');x.fillStyle=g;x.fillRect(0,0,720,1280);x.globalAlpha=.18;x.fillStyle='#fb923c';for(let k=0;k<9;k++){x.beginPath();x.arc(70+k*90,180+Math.sin(k)*25,35+(k%3)*10,0,Math.PI*2);x.fill()}x.globalAlpha=1;x.fillStyle='#fb923c';x.font='bold 30px system-ui';x.textAlign='center';x.fillText('MEDEIROS • ACHADINHOS',360,85);
// Foto real do produto em destaque. A moldura mantém o layout mesmo quando o servidor bloqueia a imagem.
x.fillStyle='#fff';x.beginPath();x.roundRect(100,125,520,430,30);x.fill();if(img){const pad=18,boxX=100+pad,boxY=125+pad,boxW=520-pad*2,boxH=430-pad*2,scale=Math.min(boxW/img.width,boxH/img.height),w=img.width*scale,h=img.height*scale;x.drawImage(img,boxX+(boxW-w)/2,boxY+(boxH-h)/2,w,h)}else{x.fillStyle='#6b7280';x.font='bold 28px system-ui';x.fillText('Imagem do produto indisponível',360,345)}
x.fillStyle='#fff';x.font='bold 39px system-ui';wrapText(x,o.productName||'Oferta especial',360,620,630,48,2);x.fillStyle='#fdba74';x.font='bold 32px system-ui';x.fillText(o.discountRate?`${Math.round(o.discountRate)}% OFF`:'OFERTA ESPECIAL',360,750);x.fillStyle='#fff';x.font='bold 65px system-ui';x.fillText(price(o),360,845);x.fillStyle='#e5e7eb';x.font='26px system-ui';x.fillText('Confira preço e disponibilidade',360,905);x.fillStyle='#f97316';x.beginPath();x.roundRect(85,960,550,95,28);x.fill();x.fillStyle='#fff';x.font='bold 34px system-ui';x.fillText('VEJA A OFERTA!',360,1020);x.font='23px system-ui';x.fillStyle='#cbd5e1';x.fillText('Preço sujeito a alteração',360,1110);x.fillStyle='#fb923c';x.font='bold 25px system-ui';x.fillText('Medeiros Divulgação Shopee',360,1190);return c}
async function makeStory(o,i){const status=$(`#linkStatus${i}`);try{status.textContent='Preparando imagem do Story…';const img=await loadPromoImage(o.imageUrl);status.textContent='Montando arte para baixar…';const canvas=canvasPromo(o,img);const blob=await new Promise(resolve=>{try{canvas.toBlob(resolve,'image/png')}catch{resolve(null)}});if(!blob){status.textContent='Não foi possível criar a imagem. Atualize a página e tente novamente.';return}downloadBlob(blob,`story-oferta-${i+1}.png`);status.textContent=img?'Imagem pronta e baixando. Abrindo o Instagram em instantes…':'Arte baixada, mas a foto do produto não carregou. Confira a conexão e tente novamente.';await new Promise(r=>setTimeout(r,1800));let opened=false;try{window.location.href='instagram://story-camera';opened=true}catch{}setTimeout(()=>{if(!document.hidden)window.open('https://www.instagram.com/','_blank')},1000);if(img)status.textContent='Imagem pronta! No Instagram, abra o Story e selecione a imagem baixada.'}catch(err){console.error('Story error:',err);status.textContent='Ocorreu um erro ao preparar a imagem. Tente novamente.'}}
document.addEventListener('click',async e=>{const story=e.target.closest('[data-story]');if(story){const i=Number(story.dataset.story);story.disabled=true;try{await makeStory(offers[i],i)}finally{story.disabled=false}return}const fb=e.target.closest('[data-fb]');if(fb){const i=Number(fb.dataset.fb),o=offers[i],t=promo(o);try{await navigator.clipboard.writeText(t)}catch{}saveHistory(t);window.open('https://www.facebook.com/groups/','_blank');$('#linkStatus'+i).textContent='Texto preparado/copiar anúncio e cole no grupo desejado. Link de afiliado deve estar gerado para atribuição.';return}const linkBtn=e.target.closest('[data-link]');if(linkBtn){const i=Number(linkBtn.dataset.link),o=offers[i];if(o.affiliateLink){await navigator.clipboard.writeText(o.affiliateLink);linkBtn.textContent='Copiado ✓';return}const appId=$('#appId').value.trim()||localStorage.getItem(userKey('appId'))||'',secret=$('#secret').value.trim()||apiSecret;if(!secret){$('#settingsModal').classList.remove('hidden');msg($('#apiResult'),'Informe o Secret para gerar o link.','err');return}linkBtn.disabled=true;$('#linkStatus'+i).textContent='Gerando link oficial…';try{const d=await callApi({action:'affiliateLink',appId,secret,originUrl:o.offerLink||o.productLink,affiliateId:localStorage.getItem(userKey('affiliateId'))||''});o.affiliateLink=d.shortLink;renderOffers();$('#linkStatus'+i).textContent='Link de afiliado gerado pela API.'}catch(err){$('#linkStatus'+i).textContent='Falha: '+err.message}finally{linkBtn.disabled=false}return}const copy=e.target.closest('[data-copy]');if(copy){const t=promo(offers[Number(copy.dataset.copy)]);await navigator.clipboard.writeText(t);saveHistory(t);copy.textContent='Copiado ✓';setTimeout(()=>copy.textContent='Copiar anúncio',1200);return}const wa=e.target.closest('[data-wa]');if(wa){const t=promo(offers[Number(wa.dataset.wa)]);saveHistory(t);window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');return}});
$('#clearHistory').onclick=()=>{localStorage.removeItem(userKey('history'));renderHistory()};
