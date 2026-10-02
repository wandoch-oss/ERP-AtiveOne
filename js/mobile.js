/* ---------- versão para celular: uma coluna, barra inferior e botão de atalho ---------- */
// automático: só vira celular em tela estreita com toque (janela estreita no computador continua na versão computador)
const MQ_CEL=window.matchMedia('(max-width: 760px) and (pointer: coarse)');
let modoDisp='auto';try{localStorage.removeItem('ao-device');modoDisp=localStorage.getItem('ao-disp')||'auto'}catch(e){}
const isMobile=()=>modoDisp==='mobile'||(modoDisp==='auto'&&MQ_CEL.matches);
if(MQ_CEL.addEventListener)MQ_CEL.addEventListener('change',()=>{if(modoDisp==='auto')render()});
function setDevice(m){modoDisp=m;try{localStorage.setItem('ao-disp',m)}catch(e){}window.scrollTo(0,0);fecharSheet();render()}

const ACOES_RAPIDAS=[['filetext','Novo orçamento',()=>novoOrc()],['users','Novo cliente',()=>editRec('clientes',null)],['funnel','Nova oportunidade',()=>editRec('oportunidades',null)],
  ['wrench','Nova OS',()=>editRec('os',null)],['dollar','Novo lançamento',()=>editRec('financeiro',null)],['calendar','Compromisso',()=>editRec('agenda',null)]];
const GRUPO_COM=['clientes','oportunidades','orcamentos','vendas'],GRUPO_FIN=['financeiro','bancos','conciliacao','fluxo','dre','dre_contabil'];
const rotRota=k=>((NAV.flatMap(g=>g.i).find(i=>i[0]===k))||[,k])[1];

function montarChromeCelular(){
  if(document.getElementById('mnav'))return;
  const d=document.createElement('div');
  d.innerHTML='<header id="mtop"><img class="msym" src="assets/simbolo-app.png" alt=""><div class="mtt"><b id="mtitle"></b><small id="msub"></small></div>'+
    '<button class="mbtn" id="mmenu" aria-label="Menu">'+ic('list',20)+'</button></header>'+
    '<nav id="mnav">'+[['painel','Painel','dashboard'],['com','Comercial','funnel'],['obras','Projetos','building'],['fin','Financeiro','dollar'],['menu','Menu','settings']]
      .map(t=>'<button data-mt="'+t[0]+'">'+ic(t[2],21)+'<span>'+t[1]+'</span></button>').join('')+'</nav>'+
    '<button id="mfab" aria-label="Criar">'+ic('plus',26)+'</button>'+
    '<div id="msheet" hidden><div class="mshbg"></div><div class="mshp"><div class="mshh"><b id="mshT"></b><button class="mbtn" id="mshX" aria-label="Fechar">'+ic('x',18)+'</button></div><div id="mshB"></div></div></div>';
  while(d.firstChild)document.body.appendChild(d.firstChild);
  document.getElementById('mmenu').onclick=()=>abrirSheet('menu');
  document.getElementById('mfab').onclick=()=>abrirSheet('fab');
  document.getElementById('mshX').onclick=fecharSheet;
  document.querySelector('#msheet .mshbg').onclick=fecharSheet;
  document.querySelectorAll('#mnav [data-mt]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.mt;
    if(k==='painel')go('painel');else if(k==='obras')go('obras');else abrirSheet(k);
  });
}
function fecharSheet(){const s=document.getElementById('msheet');if(s)s.hidden=true}
function tiles(rotas){return '<div class="mtiles">'+rotas.map(k=>'<button class="mtile'+(route===k?' on':'')+'" data-go="'+k+'"><span>'+ic(NAV_IC[k]||'dashboard',22)+'</span>'+esc(rotRota(k))+'</button>').join('')+'</div>'}
function abrirSheet(tipo){
  const s=document.getElementById('msheet'),T=document.getElementById('mshT'),B=document.getElementById('mshB');
  let h='',t='';
  if(tipo==='com'){t='Comercial';h=tiles(GRUPO_COM)}
  else if(tipo==='fin'){t='Financeiro';h=tiles(GRUPO_FIN)}
  else if(tipo==='fab'){t='Criar novo';h='<div class="mtiles">'+ACOES_RAPIDAS.map((a,i)=>'<button class="mtile" data-fab="'+i+'"><span class="acc">'+ic(a[0],22)+'</span>'+a[1]+'</button>').join('')+'</div>'}
  else{
    t='Menu';
    // o que já tem atalho na barra inferior (Painel, Comercial, Projetos, Financeiro) não se repete aqui
    h=NAV.filter(g=>g.g&&!['Comercial','Financeiro'].includes(g.g)).map(g=>({g:g.g,r:g.i.map(i=>i[0]).filter(k=>k!=='obras')})).filter(g=>g.r.length)
      .map(g=>'<div class="mgl">'+esc(g.g)+'</div>'+tiles(g.r)).join('');
    if(S.empresas.filter(e=>ativo(e)).length>1){
      h+='<div class="mgl">Unidade</div><select id="mUnid"><option value="">Todas as unidades</option>'+S.empresas.filter(e=>ativo(e)).map(e=>'<option value="'+e.id+'"'+(UNID===e.id?' selected':'')+'>'+esc(e.nome_fantasia||e.razao_social)+'</option>').join('')+'</select>';
    }
    h+='<div class="mgl">Exibição</div><div class="seg mseg">'+[['auto','Automático'],['mobile','Celular'],['desktop','Computador']].map(m=>'<button data-dev="'+m[0]+'" class="'+(modoDisp===m[0]?'on':'')+'">'+m[1]+'</button>').join('')+'</div>';
  }
  T.textContent=t;B.innerHTML=h;s.hidden=false;
  B.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{fecharSheet();go(b.dataset.go)});
  B.querySelectorAll('[data-fab]').forEach(b=>b.onclick=()=>{fecharSheet();ACOES_RAPIDAS[Number(b.dataset.fab)][2]()});
  B.querySelectorAll('[data-dev]').forEach(b=>b.onclick=()=>setDevice(b.dataset.dev));
  const u=B.querySelector('#mUnid');if(u)u.onchange=()=>{UNID=u.value;try{localStorage.setItem('ative:unid',UNID)}catch(e){}fecharSheet();render()};
}
function aplicarModoCelular(){
  const m=isMobile();document.body.classList.toggle('is-mob',m);
  if(m)montarChromeCelular();
}
function desenharCelular(){
  if(!isMobile())return;
  const el=document.getElementById('mtitle');if(!el)return;
  el.textContent=rotRota(route);
  const un=UNID?nomeUnid(UNID):'';
  document.getElementById('msub').textContent=un||(SUB[route]||'');
  const ativoTab=route==='painel'?'painel':route==='obras'?'obras':GRUPO_COM.includes(route)?'com':GRUPO_FIN.includes(route)?'fin':'menu';
  document.querySelectorAll('#mnav [data-mt]').forEach(b=>b.classList.toggle('on',b.dataset.mt===ativoTab));
  fecharSheet();
}

/* ---------- painel do celular ---------- */
function painelMobile(v){
  const mes=mesDe(hoje()),F=U('financeiro');
  const rec=F.filter(l=>l.tipo==='Receber'&&mesDe(l.vencimento)===mes).reduce((a,l)=>a+Number(l.valor||0),0);
  const pag=F.filter(l=>l.tipo==='Pagar'&&mesDe(l.vencimento)===mes).reduce((a,l)=>a+Number(l.valor||0),0);
  const ativas=U('obras').filter(o=>o.status==='Em execução');
  const vm=U('vendas').filter(x=>x.status!=='Cancelada'&&mesDe(x.data)===mes);
  const venc=contasVencidas(),est=alertasEstoque(),atras=U('os').filter(o=>o.status==='Agendada'&&o.data<hoje());
  const hr=new Date().getHours(),saud=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
  const hojeAg=S.agenda.filter(a=>a.data===hoje()).map(a=>({h:a.hora||'',t:a.titulo,s:a.tipo,k:'agenda'}))
    .concat(U('os').filter(o=>o.data===hoje()).map(o=>({h:o.hora||'',t:o.descricao||o.tipo,s:'OS · '+nm('clientes',o.cliente),k:'os'}))).sort((a,b)=>String(a.h).localeCompare(String(b.h)));
  const aten=[];
  if(venc.length)aten.push(['g-red',venc.length,'conta(s) vencida(s) · '+money(venc.reduce((a,l)=>a+Number(l.valor||0),0)),'financeiro']);
  if(est.length)aten.push(['g-amber',est.length,'item(ns) abaixo do mínimo no estoque','estoque']);
  if(atras.length)aten.push(['g-red',atras.length,'OS agendada(s) em atraso','os']);
  const funil=['Lead','Visita técnica','Proposta','Negociação'].map(e=>{const l=S.oportunidades.filter(o=>o.estagio===e);return[e,l.length,l.reduce((a,o)=>a+Number(o.valor||0),0)]});
  v.innerHTML='<div class="mhero2"><div class="mh-h">'+saud+'.</div><div class="mh-s">'+dBR(hoje())+' · '+(ativas.length?ativas.length+' projeto(s) em execução':'nenhum projeto em execução')+'</div></div>'+
    '<div class="kpis">'+kpi('Vendas no mês',money(vm.reduce((a,x)=>a+Number(x.valor||0),0)),vm.length+' venda(s)')+kpi('Projetos em execução',ativas.length,money(ativas.reduce((a,o)=>a+Number(o.valor||0),0))+' em backlog')+
      kpi('A receber no mês',money(rec))+kpi('A pagar no mês',money(pag))+'</div>'+
    '<div class="mq">'+ACOES_RAPIDAS.map((a,i)=>'<button data-qa="'+i+'"><span>'+ic(a[0],22)+'</span>'+a[1]+'</button>').join('')+'</div>'+
    '<div class="card"><div class="chead"><h2>Precisa de atenção</h2></div><div class="cbody">'+(aten.length?aten.map(a=>'<div class="mrow2" data-go="'+a[3]+'"><span class="bg '+a[0]+'">'+a[1]+'</span><span>'+esc(a[2])+'</span>'+ic('back',14)+'</div>').join(''):'<div class="empty" style="padding:14px">Nada pendente.</div>')+'</div></div>'+
    '<div class="card"><div class="chead"><h2>Hoje</h2><span class="hint">'+dBR(hoje())+'</span></div><div class="cbody">'+(hojeAg.length?hojeAg.map(a=>'<div class="mrow2" data-go="'+a.k+'"><span class="mh">'+esc(a.h||'—')+'</span><span><b>'+esc(a.t||'')+'</b><br><small>'+esc(a.s||'')+'</small></span></div>').join(''):'<div class="empty" style="padding:14px">Sem compromissos hoje.</div>')+'</div></div>'+
    '<div class="card"><div class="chead"><h2>Projetos em andamento</h2></div><div class="cbody">'+(ativas.length?ativas.map(o=>{const p=progressoObra(o);return '<div class="mproj" data-obra="'+o.id+'"><div><b>'+esc(o.codigo)+'</b> · '+esc(nm('clientes',o.cliente))+'</div><small>'+esc(o.titulo||'')+'</small><div class="bar'+(p<40?' b':p<70?' w':'')+'" style="margin-top:6px"><i style="width:'+p+'%"></i></div><small>'+p+'% concluído</small></div>'}).join(''):'<div class="empty" style="padding:14px">Nenhum projeto em execução.</div>')+'</div></div>'+
    '<div class="card"><div class="chead"><h2>Funil comercial</h2></div><div class="cbody">'+funil.map(f=>'<div class="mrow2"><span style="flex:1">'+f[0]+'</span><b>'+f[1]+'</b><span class="hint" style="min-width:96px;text-align:right">'+money(f[2])+'</span></div>').join('')+'</div></div>';
  v.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>ACOES_RAPIDAS[Number(b.dataset.qa)][2]());
  v.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  v.querySelectorAll('[data-obra]').forEach(b=>b.onclick=()=>abrirObra(b.dataset.obra));
}
if(isMobile())render();
