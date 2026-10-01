/* ---------- plano de contas ---------- */
const TIPOS_CONTA=['Receita','Custo','Despesa','Ativo','Passivo'];
const CATS_DRE=['Serviço','Material','Contrato','Mão de obra','Terceiros','Marketing','Administrativo','Impostos','Outros'];
const nivelConta=c=>String(c.codigo||'').split('.').length-1;
const cmpCodigo=(a,b)=>{
  const x=String(a.codigo||'').split('.').map(Number),y=String(b.codigo||'').split('.').map(Number);
  for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d}
  return 0;
};
const rotConta2=c=>(c.codigo?c.codigo+' · ':'')+c.nome;
const contaAnalitica=c=>ativo(c)&&c.natureza==='Analítica';
const filhosConta=id=>S.plano_contas.filter(x=>x.pai===id);

function validarConta(d){
  d.codigo=String(d.codigo||'').trim();
  if(!/^\d+(\.\d+)*$/.test(d.codigo))return 'O código usa números separados por ponto, por exemplo 3.1.01.';
  if(d.pai&&d.pai===d.id)return 'Uma conta não pode ser filha dela mesma.';
  const pai=byId('plano_contas',d.pai);
  if(pai&&!d.codigo.startsWith(pai.codigo+'.'))return 'O código da conta deve começar com o código do pai ('+pai.codigo+'.).';
  if(!pai&&d.codigo.includes('.'))return 'Conta com ponto no código precisa de uma conta pai.';
  if(d.natureza==='Sintética')d.categoria_dre='';
  if(d.id&&d.natureza==='Analítica'&&filhosConta(d.id).length)return 'Esta conta tem contas filhas, então precisa ser sintética.';
  if(pai&&pai.natureza==='Analítica')return 'O pai precisa ser uma conta sintética (de agrupamento).';
  return '';
}
function ligarContaPlano(m){
  const sel=m.querySelector('#f_conta_plano');if(!sel)return;
  sel.onchange=()=>{
    const c=byId('plano_contas',sel.value);if(!c)return;
    const cat=m.querySelector('#f_categoria');if(cat&&c.categoria_dre)cat.value=c.categoria_dre;
    const tp=m.querySelector('#f_tipo');
    if(tp&&c.tipo==='Receita')tp.value='Receber';else if(tp&&(c.tipo==='Custo'||c.tipo==='Despesa'))tp.value='Pagar';
  };
}

const PLANO_PADRAO=[
 ['1','ATIVO','Ativo','S'],
 ['1.1','Caixa e equivalentes','Ativo','S'],['1.1.01','Caixa','Ativo','A'],['1.1.02','Bancos conta movimento','Ativo','A'],['1.1.03','Aplicações financeiras','Ativo','A'],
 ['1.2','Contas a receber','Ativo','S'],['1.2.01','Clientes','Ativo','A'],['1.2.02','Adiantamentos a fornecedores','Ativo','A'],
 ['1.3','Estoques','Ativo','S'],['1.3.01','Materiais e equipamentos','Ativo','A'],
 ['2','PASSIVO','Passivo','S'],
 ['2.1','Fornecedores','Passivo','S'],['2.1.01','Fornecedores de materiais','Passivo','A'],['2.1.02','Fornecedores de serviços','Passivo','A'],
 ['2.2','Obrigações trabalhistas e tributárias','Passivo','S'],['2.2.01','Salários e encargos a pagar','Passivo','A'],['2.2.02','Impostos a recolher','Passivo','A'],
 ['2.3','Adiantamentos de clientes','Passivo','S'],['2.3.01','Entradas de contratos a executar','Passivo','A'],
 ['3','RECEITAS','Receita','S'],
 ['3.1','Receita de serviços','Receita','S'],['3.1.01','Instalação e projetos','Receita','A','Serviço'],['3.1.02','Manutenção e contratos recorrentes','Receita','A','Contrato'],['3.1.03','Visitas e serviços sob demanda','Receita','A','Serviço'],
 ['3.2','Receita de produtos','Receita','S'],['3.2.01','Venda de equipamentos','Receita','A','Material'],
 ['3.3','Outras receitas','Receita','S'],['3.3.01','Receitas financeiras e diversas','Receita','A','Outros'],
 ['4','CUSTOS','Custo','S'],
 ['4.1','Custo dos produtos aplicados','Custo','S'],['4.1.01','Materiais e equipamentos','Custo','A','Material'],
 ['4.2','Custo dos serviços','Custo','S'],['4.2.01','Mão de obra técnica','Custo','A','Mão de obra'],['4.2.02','Terceiros e subempreitadas','Custo','A','Terceiros'],['4.2.03','Deslocamento e hospedagem','Custo','A','Terceiros'],
 ['5','DESPESAS','Despesa','S'],
 ['5.1','Despesas comerciais','Despesa','S'],['5.1.01','Marketing e publicidade','Despesa','A','Marketing'],['5.1.02','Comissões','Despesa','A','Administrativo'],['5.1.03','Brindes e eventos','Despesa','A','Marketing'],
 ['5.2','Despesas administrativas','Despesa','S'],['5.2.01','Aluguel e condomínio','Despesa','A','Administrativo'],['5.2.02','Software e licenças','Despesa','A','Administrativo'],
 ['5.2.03','Pessoal administrativo','Despesa','A','Administrativo'],['5.2.04','Contabilidade e serviços profissionais','Despesa','A','Administrativo'],
 ['5.2.05','Veículos e combustível','Despesa','A','Administrativo'],['5.2.06','Energia, água e internet','Despesa','A','Administrativo'],
 ['5.2.07','Despesas bancárias','Despesa','A','Administrativo'],['5.2.08','Outras despesas administrativas','Despesa','A','Administrativo'],
 ['5.3','Impostos e taxas','Despesa','S'],['5.3.01','Impostos sobre faturamento','Despesa','A','Impostos'],['5.3.02','Outras taxas e tributos','Despesa','A','Impostos'],
 ['5.4','Outras despesas','Despesa','S'],['5.4.01','Outras despesas','Despesa','A','Outros']
];
function planoPadrao(){
  let n=0;
  PLANO_PADRAO.forEach(r=>{
    if(S.plano_contas.some(x=>x.codigo===r[0]))return;
    const pc=r[0].includes('.')?r[0].slice(0,r[0].lastIndexOf('.')):'',pai=pc?S.plano_contas.find(x=>x.codigo===pc):null;
    put('plano_contas',{codigo:r[0],nome:r[1],tipo:r[2],natureza:r[3]==='S'?'Sintética':'Analítica',pai:pai?pai.id:'',categoria_dre:r[4]||'',status:'Ativa'});
    n++;
  });
  return n;
}
const CONTA_POR_CAT={Receber:{'Serviço':'3.1.01','Contrato':'3.1.02','Material':'3.2.01','Outros':'3.3.01'},
  Pagar:{'Material':'4.1.01','Mão de obra':'4.2.01','Terceiros':'4.2.02','Marketing':'5.1.01','Administrativo':'5.2.08','Impostos':'5.3.01','Outros':'5.4.01'}};
function classificarLancamentos(){
  let n=0;
  S.financeiro.filter(l=>!l.conta_plano).forEach(l=>{
    const cod=(CONTA_POR_CAT[l.tipo]||{})[l.categoria],c=cod&&S.plano_contas.find(x=>x.codigo===cod&&contaAnalitica(x));
    if(c){l.conta_plano=c.id;put('financeiro',l);n++}
  });
  return n;
}
function totaisPlano(ano,pertence){
  const soma={},semConta={n:0,v:0};
  S.financeiro.filter(l=>String(l.vencimento||'').startsWith(ano)&&pertence('financeiro',l)).forEach(l=>{
    const v=Number(l.valor||0);
    if(!l.conta_plano||!byId('plano_contas',l.conta_plano)){semConta.n++;semConta.v+=v;return}
    let c=byId('plano_contas',l.conta_plano),g=0;
    while(c&&g++<12){soma[c.id]=(soma[c.id]||0)+v;c=c.pai?byId('plano_contas',c.pai):null}
  });
  return{soma:soma,semConta:semConta};
}
function drePlano(ano){
  const el=document.getElementById('dp');if(!el)return;
  if(!S.plano_contas.length){el.innerHTML='<div class="empty">Cadastre o plano de contas em Cadastros → Plano de contas e classifique os lançamentos para ver o resultado por conta. '+
    '<button class="btn sm" id="dpgo">Abrir plano de contas</button></div>';document.getElementById('dpgo').onclick=()=>{cadTab='plano_contas';route='cadastros';render()};return}
  const t=totaisPlano(ano,naUnid),rows=S.plano_contas.filter(c=>t.soma[c.id]).sort(cmpCodigo).filter(c=>['Receita','Custo','Despesa'].includes(c.tipo));
  el.innerHTML=tbl([{l:'Conta',s:1,f:c=>'<span style="padding-left:'+(nivelConta(c)*14)+'px;'+(c.natureza==='Sintética'?'font-weight:600':'')+'">'+esc(rotConta2(c))+'</span>'},
    {l:'Tipo',f:c=>esc(c.tipo)},{l:'Valor no ano',n:1,f:c=>'<span style="'+(c.natureza==='Sintética'?'font-weight:600':'')+'">'+money(t.soma[c.id])+'</span>'}],
    rows,{empty:'Nenhum lançamento classificado em contas de receita, custo ou despesa neste ano.'})+
    (t.semConta.n?'<div class="note">'+t.semConta.n+' lançamento(s) do ano ('+money(t.semConta.v)+') ainda sem conta do plano. Em Cadastros → Plano de contas, use "Classificar lançamentos existentes".</div>':'');
}

/* ---------- importação do plano de contas por arquivo (CSV) ---------- */
const MODELO_PLANO='codigo;nome;tipo;natureza;linha_dre\n1;ATIVO;Ativo;Sintética;\n1.1;Caixa e bancos;Ativo;Sintética;\n1.1.01;Bancos conta movimento;Ativo;Analítica;\n'+
  '3;RECEITAS;Receita;Sintética;\n3.1;Receita de serviços;Receita;Sintética;\n3.1.01;Instalação e projetos;Receita;Analítica;Serviço\n'+
  '4;CUSTOS;Custo;Sintética;\n4.1.01;Materiais e equipamentos;Custo;Analítica;Material\n5;DESPESAS;Despesa;Sintética;\n5.2.01;Aluguel e condomínio;Despesa;Analítica;Administrativo\n';
const semAcento=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function tipoPorCodigo(cod){const d=String(cod)[0];return {1:'Ativo',2:'Passivo',3:'Receita',4:'Custo'}[d]||'Despesa'}
function lerPlanoCSV(t){
  const linhas=t.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());if(!linhas.length)return[];
  const sep=[';','\t',','].map(x=>[x,linhas.slice(0,8).join('\n').split(x).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=linhas.map(l=>splitCSV(l,sep));
  const hi=rows.findIndex(r=>r.some(c=>/^(c[oó]digo|conta|classifica)/i.test(c.trim()))&&r.some(c=>/nome|descri|t[ií]tulo/i.test(c)));
  const H=hi>=0?rows[hi].map(semAcento):[],col=re=>H.findIndex(c=>re.test(c));
  let cc=col(/^(codigo|conta|classifica)/),cn=col(/nome|descri|titulo/),ct=col(/^tipo/),cna=col(/natureza|^s\/a|sintetica|analitica/),cd=col(/dre|linha/);
  if(hi<0){cc=0;cn=1;ct=-1;cna=-1;cd=-1}
  const out=[];
  rows.slice(hi+1).forEach(r=>{
    const cod=String(r[cc]||'').trim().replace(/\s+/g,'').replace(/\.+$/,''),nome=String(r[cn]||'').trim();
    if(!/^\d+(\.\d+)*$/.test(cod)||!nome)return;
    out.push({codigo:cod,nome:nome,tipo:ct>=0?r[ct]:'',natureza:cna>=0?r[cna]:'',dre:cd>=0?r[cd]:''});
  });
  return out;
}
function planejarImportacaoPlano(linhas){
  const unico=new Map();linhas.forEach(l=>{if(!unico.has(l.codigo))unico.set(l.codigo,l)});
  const novas=[],existentes=[];
  const cods=new Set([...unico.keys()].concat(S.plano_contas.map(c=>c.codigo)));
  const tipoOk=t=>TIPOS_CONTA2.find(x=>semAcento(x)===semAcento(t))||'';
  const catOk=t=>CATS_DRE.find(x=>semAcento(x)===semAcento(t))||'';
  const natOk=(l,cod)=>{const n=semAcento(l.natureza);if(n.startsWith('s'))return 'Sintética';if(n.startsWith('a'))return 'Analítica';
    return [...cods].some(c=>c.startsWith(cod+'.'))?'Sintética':'Analítica'};
  const criar=new Map();
  unico.forEach((l,cod)=>{
    if(S.plano_contas.some(c=>c.codigo===cod)){existentes.push(cod);return}
    criar.set(cod,{codigo:cod,nome:l.nome,tipo:tipoOk(l.tipo)||tipoPorCodigo(cod),natureza:natOk(l,cod),categoria_dre:catOk(l.dre)});
  });
  // pais ausentes
  let criadosAuto=0;
  [...criar.keys()].forEach(cod=>{
    let p=cod;
    while(p.includes('.')){p=p.slice(0,p.lastIndexOf('.'));
      if(cods.has(p)||criar.has(p))continue;
      criar.set(p,{codigo:p,nome:'Grupo '+p,tipo:criar.get(cod).tipo,natureza:'Sintética',categoria_dre:''});cods.add(p);criadosAuto++}
  });
  const lista=[...criar.values()].sort(cmpCodigo);
  lista.forEach(c=>{if(c.natureza==='Sintética')c.categoria_dre=''});
  return{lista:lista,existentes:existentes,auto:criadosAuto};
}
const TIPOS_CONTA2=['Receita','Custo','Despesa','Ativo','Passivo'];
async function importarPlanoArquivo(files){
  if(!files||!files.length)return;
  let linhas=[];
  for(const f of files){try{linhas=linhas.concat(lerPlanoCSV(await lerTexto(f)))}catch(e){}}
  if(!linhas.length){toast('Não consegui ler contas. Use CSV com as colunas código e nome (tipo e natureza são opcionais).');return}
  const pl=planejarImportacaoPlano(linhas);
  if(!pl.lista.length){toast('Todas as '+pl.existentes.length+' contas do arquivo já existem no plano');return}
  const ok=await ask('Importar '+pl.lista.length+' conta(s) nova(s)'+(pl.existentes.length?'; '+pl.existentes.length+' já existem e serão mantidas':'')+
    (pl.auto?'; '+pl.auto+' grupo(s) pai ausente(s) serão criados com o nome "Grupo …"':'')+'?','Importar');
  if(!ok)return;
  pl.lista.forEach(c=>{
    const pc=c.codigo.includes('.')?c.codigo.slice(0,c.codigo.lastIndexOf('.')):'',pai=pc?S.plano_contas.find(x=>x.codigo===pc):null;
    put('plano_contas',{codigo:c.codigo,nome:c.nome,tipo:c.tipo,natureza:c.natureza,pai:pai?pai.id:'',categoria_dre:c.categoria_dre,status:'Ativa'});
  });
  toast(pl.lista.length+' conta(s) importada(s)');render();
}
