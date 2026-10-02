/* ---------- notas fiscais direto da Receita ----------
   Busca NF-e (SEFAZ · NFeDistribuicaoDFe) e NFS-e (padrão nacional) do CNPJ da empresa.
   A consulta com o certificado A1 roda na Edge Function "buscar-notas" (supabase/functions);
   ela guarda os XMLs em fiscal_docs e aqui o sistema lê, confere e importa. Veja FISCAL.md. */
const UF_COD={RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,
  MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,MS:50,MT:51,GO:52,DF:53};
let fiscalOcupado=false;

function fiscalEmpresa(){return byId('empresas',UNID)||byId('empresas',empresaPadrao())||null}
const fiscalAmbiente=()=>(window.AO_CONFIG&&window.AO_CONFIG.fiscalAmbiente)||'producao';

function fiscalCard(){
  const emp=fiscalEmpresa();
  const on=MODE==='supabase';
  return '<div class="card"><div class="chead"><h2>Buscar notas na Receita</h2>'+
    '<span class="hint">NF-e e NFS-e do CNPJ da empresa, direto da SEFAZ</span></div><div class="cbody">'+
    (on?(emp&&cnpjValido(emp.cnpj)?
      '<div class="note" style="margin:0 0 10px">CNPJ consultado: <b>'+esc(fmtCNPJ(emp.cnpj))+'</b> · '+esc(emp.nome_fantasia||emp.razao_social)+
        '<span id="fiscSt"></span></div>'+
      '<div class="toolbar" style="margin:0"><button class="btn" id="fiscGo">Buscar notas agora</button>'+
      '<button class="btn sec" id="fiscPend">Ver notas encontradas</button>'+
      '<button class="btn sec" id="fiscHist">Histórico de consultas</button></div>'+
      '<div id="fiscAuto" class="note" style="margin-top:10px"></div>'+
      '<div class="note">Traz as notas em que o CNPJ aparece (compras e, quando a Receita informar, vendas) e as NFS-e. '+
      'Nada entra no estoque ou no financeiro sem você conferir.</div>'
      :'<div class="empty">Cadastre a empresa com um CNPJ válido (Cadastros → Empresas) para buscar as notas.</div>')
    :'<div class="empty">A busca na Receita precisa do modo Supabase (login e servidor). Veja o FISCAL.md.</div>')+
    '</div></div>';
}

async function fiscalWire(){
  const go=document.getElementById('fiscGo');if(!go)return;
  go.onclick=fiscalBuscar;
  document.getElementById('fiscPend').onclick=()=>fiscalMostrar();
  document.getElementById('fiscHist').onclick=()=>fiscalHistorico();
  const emp=fiscalEmpresa(),st=document.getElementById('fiscSt');
  try{
    const {data}=await SB.from('fiscal_cursor').select('servico,consultado_em,proxima_consulta').eq('org_id',ORG).eq('cnpj',soDig(emp.cnpj));
    const ult=(data||[]).map(c=>c.consultado_em).filter(Boolean).sort().pop();
    const {count}=await SB.from('fiscal_docs').select('nsu',{count:'exact',head:true}).eq('org_id',ORG).eq('processado',false);
    const {data:ci}=await SB.from('fiscal_cert_info').select('validade,titular').eq('org_id',ORG).eq('cnpj',soDig(emp.cnpj)).maybeSingle();
    const cert=ci?(diasAte(ci.validade)<0?' · <b style="color:var(--red)">certificado vencido</b>':' · certificado válido até '+esc(dBR(ci.validade))):
      ' · <b style="color:var(--amber)">sem certificado enviado</b> (Cadastros → Empresas → Certificado digital)';
    if(st&&document.body.contains(st))st.innerHTML=cert+(ult?' · última consulta '+esc(new Date(ult).toLocaleString('pt-BR')):' · ainda não consultado')+
      (count?' · <b>'+count+' documento(s) esperando conferência</b>':'');
  }catch(e){}
  fiscalAutoDesenhar();
}

/* ---------- busca automática diária (o agendamento em si é o pg_cron do FISCAL.md) ---------- */
async function fiscalAutoDesenhar(){
  const el=document.getElementById('fiscAuto'),emp=fiscalEmpresa();if(!el||!emp)return;
  const {data}=await SB.from('fiscal_config').select('ativo').eq('org_id',ORG).eq('cnpj',soDig(emp.cnpj)).maybeSingle();
  if(!document.body.contains(el))return;
  const ativa=!!(data&&data.ativo);
  el.innerHTML='Busca automática diária: <b>'+(ativa?'ligada':'desligada')+'</b>'+
    (ehAdmin()?' <button class="btn sec sm" id="fiscAutoBt">'+(ativa?'Desligar':'Ligar')+'</button>':' (só o administrador altera)')+
    '<br>Depois de ligar, o agendamento precisa estar criado no Supabase (passo 7 do FISCAL.md).';
  const bt=document.getElementById('fiscAutoBt');
  if(bt)bt.onclick=async()=>{
    const uf=UF_COD[emp.uf];if(!uf){toast('Informe a UF da empresa no cadastro');return}
    const {error}=await SB.from('fiscal_config').upsert({org_id:ORG,cnpj:soDig(emp.cnpj),uf_codigo:String(uf),ambiente:fiscalAmbiente(),ativo:!ativa});
    if(error){toast('Não foi possível salvar: '+error.message);return}
    toast(ativa?'Busca automática desligada':'Busca automática ligada');fiscalAutoDesenhar();
  };
}

/* ---------- pendências: selo no menu e aviso no Painel ---------- */
const FISCAL_N={n:0,velhas:0};let fiscalContT=0;
const FISCAL_DIAS_ALERTA=3;
async function fiscalContagem(forcar){
  if(MODE!=='supabase'||!SB||!ORG)return;
  if(!forcar&&Date.now()-fiscalContT<60000)return;
  fiscalContT=Date.now();
  try{
    const base=()=>SB.from('fiscal_docs').select('nsu',{count:'exact',head:true}).eq('org_id',ORG).eq('processado',false);
    const lim=new Date(Date.now()-FISCAL_DIAS_ALERTA*864e5).toISOString();
    const [a,b]=await Promise.all([base(),base().lt('recebido_em',lim)]);
    const n=a.count||0,v=b.count||0;
    if(n!==FISCAL_N.n||v!==FISCAL_N.velhas){FISCAL_N.n=n;FISCAL_N.velhas=v;if(!ovl.classList.contains('on'))render()}
  }catch(e){}
}

async function fiscalBuscar(){
  if(fiscalOcupado)return;
  const emp=fiscalEmpresa();
  if(!emp||!cnpjValido(emp.cnpj)){toast('Cadastre a empresa com CNPJ válido');return}
  const uf=UF_COD[emp.uf];
  if(!uf){toast('Informe a UF da empresa no cadastro');return}
  const btn=document.getElementById('fiscGo');
  fiscalOcupado=true;if(btn){btn.disabled=true;btn.textContent='Consultando a Receita…'}
  try{
    const {data,error}=await SB.functions.invoke('buscar-notas',{body:{org_id:ORG,cnpj:soDig(emp.cnpj),
      servicos:['nfe','nfse'],ambiente:fiscalAmbiente(),uf_codigo:String(uf)}});
    if(error){
      let m=error.message||'erro';
      try{const j=await error.context.json();if(j&&j.erro)m=j.erro}catch(e){}
      toast('Não foi possível buscar: '+m);return;
    }
    const nome={nfe:'NF-e',nfse:'NFS-e'},linhas=Object.keys(data||{}).map(k=>{
      const r=data[k];
      return nome[k]+': '+(r.status==='aguardar'||r.aguardar_ate&&!r.novos?
        'aguardando intervalo da Receita (até '+new Date(r.aguardar_ate).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+')':
        r.novos+' novo(s)'+(r.novos?'':(r.msg?' · '+r.msg:'')));
    });
    toast(linhas.join(' · ')||'Consulta concluída');
    if(Object.keys(data||{}).some(k=>data[k].novos))await fiscalMostrar();else render();
  }catch(e){toast('Não foi possível buscar: '+((e&&e.message)||'erro'))}
  finally{fiscalOcupado=false}
}

/* ---------- leitura dos XMLs ---------- */
function parseNFSe(txt){
  const doc=new DOMParser().parseFromString(txt,'text/xml');
  if(doc.querySelector('parsererror'))return null;
  const t=(el,n)=>{const x=el?el.getElementsByTagName(n)[0]:null;return x?x.textContent.trim():''};
  const inf=doc.getElementsByTagName('infNFSe')[0];if(!inf)return null;
  const emit=doc.getElementsByTagName('emit')[0],toma=doc.getElementsByTagName('toma')[0];
  const val=doc.getElementsByTagName('valores')[0];
  const dps=doc.getElementsByTagName('infDPS')[0]||doc;
  return{modelo:'NFS-e',chave:(inf.getAttribute('Id')||'').replace(/^NFS/,''),
    prestador_nome:t(emit,'xNome'),prestador_doc:t(emit,'CNPJ')||t(emit,'CPF'),
    tomador_nome:t(toma,'xNome'),tomador_doc:t(toma,'CNPJ')||t(toma,'CPF'),
    emissao:String(t(dps,'dhEmi')||t(inf,'dhProc')).slice(0,10)||hoje(),
    valor:Number(t(val,'vLiq')||t(doc.getElementsByTagName('vServPrest')[0],'vServ')||0),
    descricao:t(doc,'xDescServ')};
}
function parseResNFe(txt){
  const doc=new DOMParser().parseFromString(txt,'text/xml');
  const t=n=>{const x=doc.getElementsByTagName(n)[0];return x?x.textContent.trim():''};
  if(!t('chNFe'))return null;
  return{chave:t('chNFe'),nome:t('xNome'),doc:t('CNPJ')||t('CPF'),emissao:t('dhEmi').slice(0,10),valor:Number(t('vNF')||0)};
}

/* classifica o que a função trouxe: recebidas (vão para a conciliação), emitidas, NFS-e, resumos e eventos */
function fiscalClassificar(rows){
  const g={recebidas:[],emitidas:[],nfse:[],resumos:[],ignorar:[]};
  rows.forEach(r=>{
    const k={cnpj:r.cnpj,servico:r.servico,nsu:r.nsu},tipo=String(r.tipo||'');
    let n=null;
    try{
      if(r.servico==='nfse'){
        n=parseNFSe(r.xml);
        if(n){n.direcao=soDig(n.prestador_doc)===r.cnpj?'Emitida':'Recebida';n._k=k;g.nfse.push(n)}else g.ignorar.push(k);
      }else if(/^procNFe/i.test(tipo)){
        n=parseNFe(r.xml,r.chave);
        if(n){n._k=k;(soDig(n.cnpj)===r.cnpj?g.emitidas:g.recebidas).push(n)}else g.ignorar.push(k);
      }else if(/^resNFe/i.test(tipo)){
        n=parseResNFe(r.xml);if(n){n._k=k;g.resumos.push(n)}else g.ignorar.push(k);
      }else g.ignorar.push(k);   // eventos (cancelamento, manifestação…) não viram lançamento
    }catch(e){g.ignorar.push(k)}
  });
  return g;
}
async function fiscalBaixar(chaves){
  if(!chaves.length)return;
  const grupos={};
  chaves.forEach(k=>{const id=k.cnpj+'|'+k.servico;(grupos[id]=grupos[id]||{k:k,nsus:[]}).nsus.push(k.nsu)});
  for(const id of Object.keys(grupos)){
    const g=grupos[id];
    for(let i=0;i<g.nsus.length;i+=100){
      const {error}=await SB.from('fiscal_docs').update({processado:true}).eq('org_id',ORG)
        .eq('cnpj',g.k.cnpj).eq('servico',g.k.servico).in('nsu',g.nsus.slice(i,i+100));
      if(error)toast('Falha ao marcar como conferido: '+error.message);
    }
  }
  fiscalContagem(true);
}

async function fiscalMostrar(){
  const {data,error}=await SB.from('fiscal_docs').select('cnpj,servico,nsu,chave,tipo,xml').eq('org_id',ORG)
    .eq('processado',false).order('nsu').limit(300);
  if(error){toast('Erro ao ler as notas: '+error.message);return}
  const g=fiscalClassificar(data||[]);
  if(g.ignorar.length)await fiscalBaixar(g.ignorar);
  const total=g.recebidas.length+g.emitidas.length+g.nfse.length+g.resumos.length;
  if(!total){toast('Nenhuma nota nova para conferir');render();return}
  const lista=(arr,f)=>arr.slice(0,8).map(f).join('')+(arr.length>8?'<div class="note">… e mais '+(arr.length-8)+'</div>':'');
  const linha=(a,b,c)=>'<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12.5px">'+
    '<span>'+esc(a)+'<span style="color:var(--faint)"> · '+esc(b)+'</span></span><b>'+esc(c)+'</b></div>';
  const bloco=(tit,id,btn,arr,f,nota)=>arr.length?'<div class="fsec">'+tit+' ('+arr.length+')</div>'+(nota?'<div class="note" style="margin:-4px 0 8px">'+nota+'</div>':'')+
    lista(arr,f)+(btn?'<div style="margin-top:9px"><button class="btn sm" id="'+id+'">'+btn+'</button></div>':''):'';
  openM('Notas encontradas na Receita',
    bloco('NF-e recebidas (compras)','fcRec','Conferir e dar entrada',g.recebidas,n=>linha(n.fornecedor_nome,dBR(n.emissao),money(n.valor)),
      'Abre a conferência de sempre: entrada no estoque, conta a pagar e rateio por projeto.')+
    bloco('NF-e emitidas pela empresa','fcEmi','Registrar',g.emitidas,n=>linha(n.dest_nome||'—',dBR(n.emissao),money(n.valor)),
      'Ficam registradas na lista de notas, sem mexer em estoque ou financeiro.')+
    bloco('NFS-e (serviços)','fcSrv','Registrar',g.nfse,n=>linha((n.direcao==='Emitida'?n.tomador_nome:n.prestador_nome)||'—',
      n.direcao.toLowerCase()+' · '+dBR(n.emissao),money(n.valor)),'As recebidas geram conta a pagar; as emitidas só ficam registradas.')+
    bloco('Resumos sem itens','fcCie','Dar ciência e liberar o XML',g.resumos,n=>linha(n.nome||'—',dBR(n.emissao),money(n.valor)),
      'A Receita só envia o XML completo depois da “Ciência da operação”. Ela só informa que você tem conhecimento da nota — não confirma nem recusa a compra. O XML aparece aqui numa próxima busca.')
    ,null,null,true);
  const on=(id,fn)=>{const b=document.getElementById(id);if(b)b.onclick=fn};
  on('fcRec',()=>{closeM();conciliarNFe(g.recebidas,ns=>fiscalBaixar(ns.map(n=>n._k)))});
  on('fcEmi',()=>fiscalRegistrar(g.emitidas.map(n=>({modelo:'NF-e',direcao:'Emitida',chave:n.chave,emissao:n.emissao,valor:n.valor,
    contraparte:n.dest_nome,contraparte_doc:n.dest_doc,empresa_doc:soDig(n.cnpj),itens:n.itens,_k:n._k}))));
  on('fcSrv',()=>fiscalRegistrar(g.nfse.map(n=>({modelo:'NFS-e',direcao:n.direcao,chave:n.chave,emissao:n.emissao,valor:n.valor,
    contraparte:n.direcao==='Emitida'?n.tomador_nome:n.prestador_nome,contraparte_doc:n.direcao==='Emitida'?n.tomador_doc:n.prestador_doc,
    empresa_doc:soDig(n.direcao==='Emitida'?n.prestador_doc:n.tomador_doc),descricao:n.descricao,_k:n._k}))));
  on('fcCie',()=>fiscalCiencia(g.resumos));
}

// conta a receber em aberto do mesmo cliente (pelo CPF/CNPJ) com valor igual (±1%); a de valor mais próximo vence
function receberDaNota(n,usados){
  if(n.direcao!=='Emitida'||!n.contraparte_doc)return null;
  const ids=S.clientes.filter(c=>soDig(c.documento)===soDig(n.contraparte_doc)).map(c=>c.id);
  if(!ids.length)return null;
  const tol=Math.max(1,Number(n.valor||0)*0.01);
  return S.financeiro.filter(l=>l.tipo==='Receber'&&(l.status==='Pendente'||l.status==='Atrasado')&&!l.nfe_chave&&!usados.has(l.id)&&
      ids.includes(l.cliente)&&Math.abs(Number(l.valor||0)-Number(n.valor||0))<=tol)
    .sort((a,b)=>Math.abs(a.valor-n.valor)-Math.abs(b.valor-n.valor))[0]||null;
}
async function fiscalRegistrar(notas){
  const novas=notas.filter(n=>!S.nfe.some(x=>soDig(x.chave)===soDig(n.chave)));
  const pagar=novas.filter(n=>n.modelo==='NFS-e'&&n.direcao==='Recebida');
  const usados=new Set(),liga=new Map();
  novas.forEach(n=>{const l=receberDaNota(n,usados);if(l){usados.add(l.id);liga.set(n,l)}});
  const emitidas=novas.filter(n=>n.direcao==='Emitida'),semConta=emitidas.length-liga.size;
  if(!await ask('Registrar '+novas.length+' nota(s)'+(pagar.length?' e criar '+pagar.length+' conta(s) a pagar (vencimento em 30 dias)':'')+'?'+
    (liga.size?' '+liga.size+' emitida(s) serão vinculadas a contas a receber em aberto (o recebimento continua pendente).':'')+
    (semConta?' '+semConta+' emitida(s) não têm conta a receber correspondente — confira o financeiro.':''),'Registrar'))return;
  novas.forEach(n=>{
    const emp=S.empresas.find(e=>soDig(e.cnpj)===n.empresa_doc),em=emp?emp.id:(UNID||empresaPadrao());
    put('nfe',{chave:n.chave,modelo:n.modelo,direcao:n.direcao,contraparte:n.contraparte||'',contraparte_doc:n.contraparte_doc||'',
      emissao:n.emissao,valor:n.valor,itens:n.itens||[],descricao:n.descricao||'',empresa:em,
      receber:liga.has(n)?liga.get(n).id:''});
    if(liga.has(n)){const l=liga.get(n);l.nfe_chave=n.chave;put('financeiro',l)}
    if(n.modelo==='NFS-e'&&n.direcao==='Recebida'){
      let forn=S.fornecedores.find(f=>n.contraparte_doc&&soDig(f.cnpj)===soDig(n.contraparte_doc));
      if(!forn)forn=put('fornecedores',{nome:n.contraparte||'Prestador não identificado',cnpj:n.contraparte_doc,categoria:'Serviços'});
      put('financeiro',{tipo:'Pagar',descricao:'NFS-e '+String(n.chave).slice(-8)+' · '+(n.contraparte||''),categoria:'Terceiros',
        valor:n.valor,vencimento:addDias(hoje(),30),fornecedor:forn.id,empresa:em,status:'Pendente'});
    }
  });
  await fiscalBaixar(notas.map(n=>n._k));
  closeM();toast(novas.length+' nota(s) registrada(s)');render();
}

async function fiscalCiencia(resumos){
  const emp=fiscalEmpresa();
  if(!await ask('Registrar a ciência da operação de '+resumos.length+' nota(s) na Receita? Isso informa que você tem conhecimento delas; não confirma nem recusa a compra.','Registrar ciência'))return;
  const b=document.getElementById('fcCie');if(b){b.disabled=true;b.textContent='Enviando à Receita…'}
  const {data,error}=await SB.functions.invoke('buscar-notas',{body:{acao:'ciencia',org_id:ORG,cnpj:soDig(emp.cnpj),
    ambiente:fiscalAmbiente(),chaves:resumos.map(n=>n.chave)}});
  if(error){let m=error.message||'erro';try{const j=await error.context.json();if(j&&j.erro)m=j.erro}catch(e){}
    toast('Não foi possível registrar: '+m);if(b){b.disabled=false;b.textContent='Dar ciência e liberar o XML'}return}
  const r=data.ciencia||{},feitas=resumos.filter(n=>r[n.chave]&&r[n.chave].ok),falhas=resumos.filter(n=>!(r[n.chave]&&r[n.chave].ok));
  await fiscalBaixar(feitas.map(n=>n._k));
  closeM();
  toast(feitas.length+' ciência(s) registrada(s)'+(falhas.length?' · '+falhas.length+' falhou: '+((r[falhas[0].chave]||{}).msg||'erro'):'')+
    (feitas.length?' · busque de novo para receber o XML':''));
  render();
}

/* ---------- manifestação do destinatário (confirmar, desconhecer, não realizada) ---------- */
const MANIF={confirmacao:'Confirmação da operação',desconhecimento:'Desconhecimento da operação',nao_realizada:'Operação não realizada'};
const MANIF_AJUDA={confirmacao:'Você confirma que recebeu a mercadoria e que a operação aconteceu.',
  desconhecimento:'Você não reconhece esta compra (por exemplo, nota emitida em seu nome por engano).',
  nao_realizada:'A operação foi feita na nota, mas a mercadoria não chegou ou foi recusada. Exige justificativa.'};
const fiscalManifestavel=r=>MODE==='supabase'&&r.modelo!=='NFS-e'&&r.direcao!=='Emitida'&&String(r.chave||'').replace(/\D/g,'').length===44;
function fiscalColManifestacao(r){
  if(r.manifestacao)return '<span class="bg g-green">'+esc(MANIF[r.manifestacao]||r.manifestacao)+'</span>';
  return fiscalManifestavel(r)?'<button class="btn sec sm" data-mf="'+r.id+'">Manifestar</button>':'<span class="bg g-gray">—</span>';
}
function fiscalWireLista(el){el.querySelectorAll('[data-mf]').forEach(b=>b.onclick=()=>fiscalManifestar(b.dataset.mf))}
function fiscalManifestar(id){
  const nf=byId('nfe',id),emp=fiscalEmpresa();if(!nf||!emp)return;
  const f=[{k:'tipo',l:'Manifestação',t:'select',opts:Object.keys(MANIF).map(k=>({v:k,l:MANIF[k]})),req:1},
    {k:'justificativa',l:'Justificativa (obrigatória em “não realizada”, 15 a 255 caracteres)',t:'textarea'}];
  openM('Manifestar a nota '+String(nf.chave).slice(-8),formHtml(f,{tipo:'confirmacao'})+
    '<div class="note" id="mfAj">'+esc(MANIF_AJUDA.confirmacao)+'</div>'+
    '<div class="note" style="color:var(--amber)">A manifestação é registrada na Receita e não pode ser desfeita.</div>','Enviar à Receita',async d=>{
    if(d.tipo==='nao_realizada'&&String(d.justificativa||'').trim().length<15){toast('Escreva a justificativa (mínimo 15 caracteres)');return}
    const b=document.getElementById('mSave');b.disabled=true;b.textContent='Enviando…';
    const {data,error}=await SB.functions.invoke('buscar-notas',{body:{acao:'manifestar',tipo:d.tipo,justificativa:d.justificativa,
      org_id:ORG,cnpj:soDig(nf.dest_cnpj||emp.cnpj),ambiente:fiscalAmbiente(),chaves:[nf.chave]}});
    b.disabled=false;b.textContent='Enviar à Receita';
    if(error){let m=error.message||'erro';try{const j=await error.context.json();if(j&&j.erro)m=j.erro}catch(e){}toast('Não foi possível enviar: '+m);return}
    const r=(data.ciencia||{})[soDig(nf.chave)]||{};
    if(!r.ok){toast('A Receita não aceitou: '+(r.msg||'erro')+(r.cStat?' ('+r.cStat+')':''));return}
    nf.manifestacao=d.tipo;nf.manifestado_em=hoje();put('nfe',nf);
    closeM();toast(MANIF[d.tipo]+' registrada');render();
  });
  const sel=document.getElementById('f_tipo');
  if(sel)sel.onchange=()=>{document.getElementById('mfAj').textContent=MANIF_AJUDA[sel.value]||''};
}

/* ---------- certificado digital no cadastro da empresa ---------- */
function fiscalCertTela(emp){
  if(!emp)return '<div class="empty">Salve a empresa primeiro. Em seguida esta aba libera o envio do certificado digital.</div>';
  if(MODE!=='supabase')return '<div class="empty">O envio do certificado precisa do modo Supabase (login e servidor). Veja o FISCAL.md.</div>';
  return '<div class="card" style="margin-bottom:12px"><div class="cbody"><div id="certInfo" class="note" style="margin:0">Consultando…</div></div></div>'+
    (ehAdmin()?'<div class="fsec">Enviar certificado A1</div>'+
      '<label class="f"><span>Arquivo do certificado (.pfx ou .p12)</span><input type="file" id="certFl" accept=".pfx,.p12"></label>'+
      '<label class="f"><span>Senha do certificado</span><input type="password" id="certPw" autocomplete="off" style="width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:7px;background:var(--panel-2)"></label>'+
      '<button class="btn sm" id="certUp">Enviar certificado</button> <span class="note" id="certMsg"></span>'+
      '<div class="note">O arquivo e a senha seguem por conexão segura até a função no Supabase. A senha <b>não é guardada</b>; o certificado fica '+
      'cifrado no banco e nunca volta para o navegador. É usado só para consultar a Receita. Só o administrador envia ou remove. '+
      'Use o certificado A1 do CNPJ desta empresa.</div>':
      '<div class="note">Só o administrador envia ou remove o certificado.</div>');
}
async function fiscalCertWire(emp){
  const info=document.getElementById('certInfo');if(!info||!emp||MODE!=='supabase')return;
  const cnpj=soDig(emp.cnpj),msg=document.getElementById('certMsg');
  const desenhar=async()=>{
    const {data}=await SB.from('fiscal_cert_info').select('*').eq('org_id',ORG).eq('cnpj',cnpj).maybeSingle();
    if(!document.body.contains(info))return;
    if(!data){info.innerHTML='<span class="bg g-amber">sem certificado</span> Nenhum certificado enviado para este CNPJ.';return}
    const d=diasAte(data.validade);
    info.innerHTML='<span class="bg '+(d<0?'g-red':d<=30?'g-amber':'g-green')+'">'+(d<0?'vencido':d<=30?'vence em '+d+' dia(s)':'válido')+'</span> '+
      '<b>'+esc(data.titular||'—')+'</b><br>Validade: '+esc(dBR(data.validade))+' · enviado em '+esc(new Date(data.enviado_em).toLocaleDateString('pt-BR'))+
      ' · impressão digital '+esc(String(data.fingerprint||'').slice(0,12))+'…'+
      (ehAdmin()?'<br><button class="btn dgr sm" id="certRm" style="margin-top:8px">Remover certificado</button>':'');
    const rm=document.getElementById('certRm');
    if(rm)rm.onclick=async()=>{
      if(!await ask('Remover o certificado desta empresa? A busca de notas para este CNPJ para de funcionar até enviar outro.','Remover'))return;
      const r=await fiscalCertChamar({acao:'certificado_remover',org_id:ORG,cnpj:cnpj});
      if(r.erro){toast(r.erro);return}
      toast('Certificado removido');desenhar();
    };
  };
  desenhar();
  const up=document.getElementById('certUp');
  if(up)up.onclick=async()=>{
    const f=document.getElementById('certFl').files[0],pw=document.getElementById('certPw');
    if(!f){msg.textContent='Escolha o arquivo .pfx ou .p12.';return}
    if(f.size>200*1024){msg.textContent='Arquivo grande demais para um certificado A1.';return}
    if(!pw.value){msg.textContent='Informe a senha do certificado.';return}
    if(!cnpjValido(emp.cnpj)){msg.textContent='Corrija o CNPJ da empresa antes.';return}
    up.disabled=true;msg.textContent='Enviando…';
    let bin='';new Uint8Array(await f.arrayBuffer()).forEach(b=>bin+=String.fromCharCode(b));
    const r=await fiscalCertChamar({acao:'certificado_enviar',org_id:ORG,cnpj:cnpj,pfx_b64:btoa(bin),senha:pw.value});
    pw.value='';up.disabled=false;
    if(r.erro){msg.textContent=r.erro;return}
    msg.textContent='';document.getElementById('certFl').value='';toast('Certificado guardado');desenhar();
  };
}
async function fiscalCertChamar(body){
  const {data,error}=await SB.functions.invoke('buscar-notas',{body:body});
  if(error){let m=error.message||'erro';try{const j=await error.context.json();if(j&&j.erro)m=j.erro}catch(e){}return{erro:m}}
  return data||{};
}

/* ---------- histórico de consultas ---------- */
const FISCAL_ACOES={buscar:'Busca',ciencia:'Ciência',confirmacao:'Confirmação',desconhecimento:'Desconhecimento',nao_realizada:'Não realizada',certificado:'Certificado'};
function fiscalStatusBadge(l){
  const st=String(l.status||'');
  if(st==='erro'||st==='656'||/^(5|4)\d\d$/.test(st))return '<span class="bg g-red">'+esc(st==='656'?'656 · consumo indevido':st)+'</span>';
  if(st==='aguardar')return '<span class="bg g-amber">aguardando intervalo</span>';
  if(l.novos>0||['138','135','136','573','enviado','removido','200'].includes(st))return '<span class="bg g-green">'+esc(st==='138'?'138 · notas novas':st)+'</span>';
  if(st==='137'||st==='404')return '<span class="bg g-gray">'+esc(st==='137'?'137 · nada novo':st)+'</span>';
  return '<span class="bg g-gray">'+esc(st||'—')+'</span>';
}
async function fiscalHistorico(){
  const {data,error}=await SB.from('fiscal_log').select('*').eq('org_id',ORG).order('criado_em',{ascending:false}).limit(100);
  if(error){toast('Erro ao ler o histórico: '+error.message);return}
  const erros=(data||[]).filter(l=>l.status==='erro'||l.status==='656').length;
  openM('Histórico de consultas à Receita',
    '<div class="note" style="margin:0 0 10px">Últimas '+(data||[]).length+' operações'+(erros?' · <b style="color:var(--red)">'+erros+' com erro</b>':'')+
    '. 137 = nada novo · 138 = notas novas · 656 = a Receita pediu para esperar ~1 hora · 135/136/573 = manifestação aceita.</div>'+
    tbl([{l:'Quando',f:l=>'<span style="white-space:nowrap">'+esc(new Date(l.criado_em).toLocaleString('pt-BR'))+'</span>'},
      {l:'CNPJ',f:l=>'<span style="font-size:11.5px">'+esc(fmtCNPJ(l.cnpj))+'</span>'},
      {l:'Operação',s:1,f:l=>esc((FISCAL_ACOES[l.acao]||l.acao)+(l.servico?' · '+(l.servico==='nfse'?'NFS-e':'NF-e'):''))},
      {l:'Resultado',f:fiscalStatusBadge},
      {l:'Notas',n:1,f:l=>l.novos==null?'—':l.novos},
      {l:'Origem',f:l=>'<span class="bg '+(l.origem==='agendada'?'g-purple':'g-gray')+'">'+esc(l.origem)+'</span>'},
      {l:'Mensagem',f:l=>'<span style="font-size:12px">'+esc(l.mensagem||'')+'</span>'}],
      data||[],{empty:'Nenhuma consulta feita ainda.'}),null,null,true);
}
