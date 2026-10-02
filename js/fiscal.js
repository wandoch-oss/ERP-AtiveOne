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
      '<button class="btn sec" id="fiscPend">Ver notas encontradas</button></div>'+
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
  const emp=fiscalEmpresa(),st=document.getElementById('fiscSt');
  try{
    const {data}=await SB.from('fiscal_cursor').select('servico,consultado_em,proxima_consulta').eq('org_id',ORG).eq('cnpj',soDig(emp.cnpj));
    const ult=(data||[]).map(c=>c.consultado_em).filter(Boolean).sort().pop();
    const {count}=await SB.from('fiscal_docs').select('nsu',{count:'exact',head:true}).eq('org_id',ORG).eq('processado',false);
    if(st&&document.body.contains(st))st.innerHTML=(ult?' · última consulta '+esc(new Date(ult).toLocaleString('pt-BR')):' · ainda não consultado')+
      (count?' · <b>'+count+' documento(s) esperando conferência</b>':'');
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
