/* ---------- estado e persistência ---------- */
const COLS=['clientes','oportunidades','orcamentos','obras','os','agenda','contratos','apontamentos',
'produtos','servicos','locais','estoque','compras','fornecedores','financeiro','nfe','campanhas',
'concorrentes','colaboradores','ajustes','reservas','aditivos','familias','categorias','vendas','canais','empresas','centros_lucro','centros_custo'];
const S={}; COLS.forEach(c=>S[c]=[]);
let DB=null, DL=null, FB=null, ASSETS=null, MODE='local', pend={};

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function lsLoad(){COLS.forEach(c=>{try{const v=localStorage.getItem('nucleo:'+c);if(v)S[c]=JSON.parse(v)}catch(e){}})}
const limpo=o=>JSON.parse(JSON.stringify(o));
const erroSalvar=e=>toast('Falha ao salvar: '+((e&&(e.code||e.message))||'erro'));
function save(c,op){
  op=op||{type:'all'};
  if(MODE==='firebase'){
    if(op.type==='upsert')return FB.collection(c).doc(op.rec.id).set(limpo(op.rec)).catch(erroSalvar);
    if(op.type==='remove')return FB.collection(c).doc(op.id).delete().catch(erroSalvar);
    return fbSubstituir(c).catch(erroSalvar);
  }
  if(MODE==='local'){try{localStorage.setItem('nucleo:'+c,JSON.stringify(S[c]))}catch(e){}return}
  clearTimeout(pend[c]);
  pend[c]=setTimeout(()=>{DB.doc('col/'+c).set({items:S[c]}).catch(erroSalvar)},280);
}
async function fbSubstituir(c){
  const atual=await FB.collection(c).get(), ids=new Set(S[c].map(r=>r.id)), ops=[];
  atual.docs.forEach(d=>{if(!ids.has(d.id))ops.push(b=>b.delete(d.ref))});
  S[c].forEach(r=>ops.push(b=>b.set(FB.collection(c).doc(r.id),limpo(r))));
  for(let i=0;i<ops.length;i+=450){const b=FB.batch();ops.slice(i,i+450).forEach(f=>f(b));await b.commit()}
}
function put(c,rec){
  if(!rec.id){rec.id=uid();S[c].push(rec)}
  else{const i=S[c].findIndex(x=>x.id===rec.id);i<0?S[c].push(rec):S[c][i]=rec}
  save(c,{type:'upsert',rec:rec});return rec;
}
function del(c,id){S[c]=S[c].filter(x=>x.id!==id);save(c,{type:'remove',id:id})}
const byId=(c,id)=>S[c].find(x=>x.id===id)||null;
let UNID='';try{UNID=localStorage.getItem('ative:unid')||''}catch(e){}
function empresaPadrao(){const m=S.empresas.find(e=>e.tipo==='Matriz'&&ativo(e))||S.empresas.find(e=>ativo(e));return m?m.id:''}
function empDe(col,r){
  if(!r)return empresaPadrao();
  if(r.empresa)return r.empresa;
  if(col==='estoque'){const l=byId('locais',r.local);if(l&&l.empresa)return l.empresa}
  if(r.obra&&col!=='obras'){const o=byId('obras',r.obra);if(o&&o.empresa)return o.empresa}
  if(r.venda&&col!=='vendas'){const v=byId('vendas',r.venda);if(v&&v.empresa)return v.empresa}
  if(r.contrato){const c=byId('contratos',r.contrato);if(c&&c.empresa)return c.empresa}
  if(col==='vendas'||col==='obras'){const o=r.orcamento&&byId('orcamentos',r.orcamento);if(o&&o.empresa)return o.empresa}
  return empresaPadrao();
}
const naUnid=(col,r)=>!UNID||empDe(col,r)===UNID;
const U=col=>UNID?S[col].filter(r=>naUnid(col,r)):S[col];
const multiUnid=()=>S.empresas.filter(e=>ativo(e)).length>1;
const nomeUnid=id=>{const e=byId('empresas',id);return e?(e.nome_fantasia||e.razao_social):'—'};
const campoUnid={k:'empresa',l:'Unidade',t:'ref',col:'empresas',filtro:r=>ativo(r),rotulo:r=>(r.nome_fantasia||r.razao_social)+' · '+r.tipo};
const rotCentro=r=>(r.codigo?r.codigo+' · ':'')+r.nome;
const campoCL={k:'centro_lucro',l:'Centro de lucro',t:'ref',col:'centros_lucro',filtro:r=>ativo(r),rotulo:rotCentro};
const campoCC={k:'centro_custo',l:'Centro de custo',t:'ref',col:'centros_custo',filtro:r=>ativo(r),rotulo:rotCentro};
function centroDe(tipo,col,r){
  const k=tipo==='lucro'?'centro_lucro':'centro_custo';if(!r)return '';
  if(r[k])return r[k];
  if(r.obra&&col!=='obras'){const o=byId('obras',r.obra);if(o&&o[k])return o[k]}
  if(r.venda&&col!=='vendas'){const v=byId('vendas',r.venda);if(v&&v[k])return v[k]}
  if(r.contrato){const c=byId('contratos',r.contrato);if(c&&c[k])return c[k]}
  if(col==='obras'&&r.venda){const v=byId('vendas',r.venda);if(v&&v[k])return v[k]}
  return '';
}
const nomeCentro=(tipo,id)=>{if(!id)return 'Sem centro';const r=byId(tipo==='lucro'?'centros_lucro':'centros_custo',id);return r?rotCentro(r):'Sem centro'};
const ehCtrCliente=c=>!c.tipo||c.tipo==='Cliente';
const ehCtrVenda=c=>ehCtrCliente(c)&&c.subtipo==='Venda';
const ehCtrManut=c=>ehCtrCliente(c)&&c.subtipo!=='Venda';
const COBR_OS=['Sob demanda','Incluída no projeto','Garantia','Contrato de manutenção','Sem cobrança'];
const cobrOS=o=>o.cobranca||(o.tipo==='Garantia'?'Garantia':o.contrato?'Contrato de manutenção':o.tipo==='Instalação'?'Incluída no projeto':o.tipo==='Visita técnica'&&!o.obra?'Sem cobrança':'Sob demanda');
const centroPorNome=(col,re)=>{const c=S[col].filter(ativo).find(x=>re.test(x.nome));return c?c.id:''};
const ehCtrForn=c=>c.tipo==='Fornecedor';
function ctrVenceNoMes(c,mes){
  if(ehCtrVenda(c))return false;
  if(!c.inicio||mesDe(c.inicio)>mes)return false;
  if(c.fim&&mesDe(c.fim)<mes)return false;
  const per=ehCtrForn(c)?(PERIODOS[c.periodicidade]||1):1;
  const [y0,m0]=mesDe(c.inicio).split('-').map(Number),[y1,m1]=mes.split('-').map(Number);
  return ((y1-y0)*12+(m1-m0))%per===0;
}
function vencNoMes(mes,dia){const [y,m]=mes.split('-').map(Number),ult=new Date(y,m,0).getDate();
  return mes+'-'+String(Math.min(Math.max(1,Number(dia)||10),ult)).padStart(2,'0')}
function gerarLancContratos(tipo,mes){
  let n=0;
  U('contratos').filter(c=>c.status==='Ativo'&&(tipo==='Fornecedor'?ehCtrForn(c):ehCtrManut(c))&&ctrVenceNoMes(c,mes)).forEach(c=>{
    if(S.financeiro.some(l=>l.contrato===c.id&&mesDe(l.vencimento)===mes))return;
    if(tipo==='Fornecedor')put('financeiro',{tipo:'Pagar',descricao:'Contrato '+c.objeto+' · '+mesLabel(mes),categoria:c.categoria||'Administrativo',
      valor:Number(c.valor||0),vencimento:vencNoMes(mes,c.dia_venc),fornecedor:c.fornecedor,empresa:empDe('contratos',c),
      centro_custo:c.centro_custo||'',obra:c.obra||'',contrato:c.id,status:'Pendente'});
    else put('financeiro',{tipo:'Receber',descricao:'Contrato '+c.plano+' · '+mesLabel(mes),categoria:'Contrato',
      valor:Number(c.valor||0),vencimento:vencNoMes(mes,c.dia_venc||10),cliente:c.cliente,empresa:empDe('contratos',c),
      contrato:c.id,status:'Pendente'});
    n++;
  });
  return n;
}
const custoMensalForn=c=>Number(c.valor||0)/(PERIODOS[c.periodicidade]||1);
const colUnid=col=>(!UNID&&multiUnid())?[{l:'Unidade',f:r=>'<span style="font-size:12px">'+esc(nomeUnid(empDe(col,r)))+'</span>'}]:[];
const nm=(c,id,f)=>{const r=byId(c,id);return r?(r[f||'nome']||'—'):'—'};

/* ---------- formatação ---------- */
const BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money=v=>BRL.format(Number(v)||0);
const num=(v,d)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d||0,maximumFractionDigits:d===undefined?1:d});
const pct=v=>(Number(v)||0).toFixed(1).replace('.',',')+'%';
function dBR(s){if(!s)return '—';const p=String(s).slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s}
const hoje=()=>new Date().toISOString().slice(0,10);
function addDias(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
const mesDe=s=>String(s||'').slice(0,7);
function mesLabel(m){const M=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const p=m.split('-');return M[Number(p[1])-1]+'/'+p[0].slice(2)}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200)}

const VERTICAIS=['Residencial','Predial','Corporativo'];
const INDICES=['Nenhum','IPCA','IGP-M','INPC','Fixo'];
const MESES_OPT=[{v:'',l:'—'}].concat(['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'].map((m,i)=>({v:String(i+1),l:m})));
const PERIODOS={'Mensal':1,'Bimestral':2,'Trimestral':3,'Semestral':6,'Anual':12};
const MOTIVOS_PERDA=['Preço','Prazo','Escolheu concorrente','Projeto adiado','Sem retorno do cliente','Escopo não atendido','Outro'];
const canalRot=c=>c?(c.tipo+' · '+c.nome):'';
const canalNome=v=>{if(!v)return 'Não informado';const c=S.canais.find(x=>x.id===v);return c?canalRot(c):v};
const bgFor=s=>({'Fechada':'g-green','Convertido':'g-green','Cancelada':'g-red','Aprovado':'g-green','Concluída':'g-green','Ativo':'g-green','Recebido':'g-green','Pago':'g-green',
 'Em execução':'g-brand','Em aberto':'g-amber','Enviado':'g-amber','Agendada':'g-amber','Pendente':'g-amber',
 'Atrasado':'g-red','Cancelado':'g-red','Perdido':'g-red','Rascunho':'g-gray','Encerrado':'g-gray'}[s]||'g-gray');

/* ---------- modal e formulários ---------- */
const ovl=document.getElementById('ovl'), modal=document.getElementById('modal');
let onSave=null;
function closeM(){ovl.classList.remove('on');onSave=null}
ovl.addEventListener('click',e=>{if(e.target===ovl)closeM()});
function openM(title,bodyHtml,saveLabel,fn,wide){
  modal.className=wide?'wide':'';
  modal.innerHTML='<div class="mhead"><h3>'+esc(title)+'</h3><button class="x" onclick="closeM()">&times;</button></div>'+
    '<div class="mbody">'+bodyHtml+'</div>'+
    '<div class="mfoot"><button class="btn sec" onclick="closeM()">Fechar</button>'+
    (fn?'<button class="btn" id="mSave">'+esc(saveLabel||'Salvar')+'</button>':'')+'</div>';
  ovl.classList.add('on');onSave=fn;
  const b=document.getElementById('mSave');
  if(b)b.onclick=()=>{const d=readForm();if(d)onSave(d)};
}
function field(f,val){
  const v=val==null?'':val, id='f_'+f.k;
  let inp;
  if(f.t==='select'){
    inp='<select id="'+id+'" data-k="'+f.k+'">'+(f.req?'':'<option value=""></option>')+
      f.opts.map(o=>{const ov=typeof o==='object'?o.v:o, ol=typeof o==='object'?o.l:o;
        return '<option value="'+esc(ov)+'"'+(String(v)===String(ov)?' selected':'')+'>'+esc(ol)+'</option>'}).join('')+'</select>';
  }else if(f.t==='ref'){
    const lab=f.lab||'nome';
    const list=(S[f.col]||[]).filter(o=>!f.filtro||f.filtro(o)||o.id===v)
      .slice().sort((a,b)=>String(a[lab]||'').localeCompare(String(b[lab]||'')));
    const antigo=v&&!byId(f.col,v)?'<option value="'+esc(v)+'" selected>'+esc(v)+' (antigo)</option>':'';
    inp='<select id="'+id+'" data-k="'+f.k+'"><option value=""></option>'+antigo+
      list.map(o=>'<option value="'+o.id+'"'+(v===o.id?' selected':'')+'>'+esc((f.rotulo?f.rotulo(o):o[lab])||'—')+
        (f.filtro&&!f.filtro(o)?' (cancelado)':'')+'</option>').join('')+'</select>';
  }else if(f.t==='textarea'){
    inp='<textarea id="'+id+'" data-k="'+f.k+'">'+esc(v)+'</textarea>';
  }else if(f.t==='money'||f.t==='number'){
    inp='<input type="number" step="'+(f.step||'0.01')+'" id="'+id+'" data-k="'+f.k+'" value="'+esc(v)+'">';
  }else{
    inp='<input type="'+(f.t==='date'?'date':'text')+'" id="'+id+'" data-k="'+f.k+'" value="'+esc(v)+'">';
  }
  return '<label class="f"><span>'+esc(f.l)+(f.req?' *':'')+'</span>'+inp+'</label>';
}
function formHtml(fields,rec){
  rec=rec||{};let out='',buf=[];
  fields.forEach(f=>{
    if(f.t==='vazio'){buf.push('<div></div>');if(buf.length===2){out+=wrapRow(buf);buf=[]}return}
    if(f.t==='secao'){if(buf.length){out+=wrapRow(buf);buf=[]}out+='<div class="fsec">'+esc(f.l)+'</div>'+(f.nota?'<div class="note" style="margin:-4px 0 8px">'+esc(f.nota)+'</div>':'');return}
    const h=field(f,rec[f.k]);
    if(f.t==='textarea'||f.full){if(buf.length){out+=wrapRow(buf);buf=[]}out+=h}
    else{buf.push(h);if(buf.length===2){out+=wrapRow(buf);buf=[]}}
  });
  if(buf.length)out+=wrapRow(buf);
  return out+'<input type="hidden" id="f_id" data-k="id" value="'+esc(rec.id||'')+'">';
}
const wrapRow=b=>b.length===2?'<div class="frow">'+b.join('')+'</div>':b[0];
function readForm(){
  const d={};let ok=true;
  modal.querySelectorAll('[data-k]').forEach(el=>{
    let v=el.value;
    if(el.type==='number')v=v===''?0:Number(v);
    d[el.dataset.k]=v;
    if(el.previousElementSibling&&el.previousElementSibling.textContent.endsWith('*')&&!String(v).trim()){ok=false;el.style.borderColor='var(--red)'}
  });
  if(!ok){toast('Preencha os campos obrigatórios');return null}
  if(!d.id)delete d.id;
  return d;
}

/* ---------- tabela genérica ---------- */
function tbl(cols,rows,opts){
  opts=opts||{};
  if(!rows.length)return '<div class="empty">'+(opts.empty||'Nenhum registro ainda.')+'</div>';
  let h='<div class="scr"><table><thead><tr>'+cols.map(c=>'<th'+(c.n?' class="n"':'')+'>'+esc(c.l)+'</th>').join('')+
    (opts.acts?'<th></th>':'')+'</tr></thead><tbody>';
  rows.forEach(r=>{
    h+='<tr'+(opts.onRow?' class="clk" data-id="'+r.id+'"':'')+'>'+
      cols.map(c=>'<td class="'+(c.n?'n ':'')+(c.s?'s':'')+'">'+(c.f?c.f(r):esc(r[c.k]))+'</td>').join('')+
      (opts.acts?'<td class="n"><button class="btn sec sm" data-ed="'+r.id+'">Editar</button></td>':'')+'</tr>';
  });
  h+='</tbody>'+(opts.foot||'')+'</table></div>';
  return h;
}
function wireTable(el,col,opts){
  opts=opts||{};
  el.querySelectorAll('[data-ed]').forEach(b=>b.onclick=e=>{e.stopPropagation();editRec(col,b.dataset.ed)});
  if(opts.onRow)el.querySelectorAll('tr.clk').forEach(t=>t.onclick=()=>opts.onRow(t.dataset.id));
}
/* ---------- esquemas ---------- */
const SCH={
 clientes:{t:'Cliente',f:[
   {t:'secao',l:'Dados básicos'},
   {k:'nome',l:'Nome / razão social',req:1},{k:'vertical',l:'Vertical',t:'select',opts:VERTICAIS,req:1},
   {k:'contato',l:'Contato principal'},{k:'telefone',l:'Telefone / WhatsApp',req:1},
   {k:'email',l:'E-mail'},{k:'cidade',l:'Cidade / região'},
   {t:'secao',l:'Dados completos',nota:'Podem ficar em branco agora — são exigidos quando a venda for registrada.'},
   {k:'pessoa',l:'Tipo de pessoa',t:'select',opts:['Física','Jurídica']},{k:'documento',l:'CPF / CNPJ'},
   {k:'endereco',l:'Endereço completo',full:1},{k:'cep',l:'CEP'},{k:'ie',l:'Inscrição estadual'},
   {k:'obs',l:'Observações',t:'textarea'}]},
 fornecedores:{t:'Fornecedor',f:[
   {k:'nome',l:'Nome',req:1},{k:'cnpj',l:'CNPJ'},{k:'categoria',l:'Categoria'},
   {k:'contato',l:'Contato'},{k:'telefone',l:'Telefone'},{k:'prazo',l:'Prazo médio (dias)',t:'number',step:'1'}]},
 produtos:{t:'Produto',f:[
   {k:'sku',l:'SKU',req:1},{k:'nome',l:'Descrição',req:1},
   {k:'categoria',l:'Categoria'},{k:'unidade',l:'Unidade'},
   {k:'custo',l:'Custo (R$)',t:'money'},{k:'venda',l:'Preço de venda (R$)',t:'money'},
   {k:'minimo',l:'Estoque mínimo',t:'number',step:'1'},{k:'fornecedor',l:'Fornecedor padrão',t:'ref',col:'fornecedores'}]},
 servicos:{t:'Serviço',f:[
   {k:'nome',l:'Descrição',req:1},{k:'unidade',l:'Unidade',t:'select',opts:['hora','verba','ponto','m²']},
   {k:'custo',l:'Custo unitário (R$)',t:'money'},{k:'venda',l:'Venda unitária (R$)',t:'money'}]},
 colaboradores:{t:'Colaborador',f:[
   {k:'nome',l:'Nome',req:1},{k:'funcao',l:'Função'},
   {k:'custo_hora',l:'Custo/hora (R$)',t:'money'},{k:'capacidade',l:'Horas/semana',t:'number',step:'1'}]},
 locais:{t:'Local de estoque',f:[
   {k:'nome',l:'Nome',req:1},
   {k:'tipo',l:'Tipo',t:'select',opts:['Almoxarifado','Técnico','Obra','Trânsito'],req:1},campoUnid,
   {k:'responsavel',l:'Responsável',t:'ref',col:'colaboradores'}]},
 oportunidades:{t:'Oportunidade',fem:1,f:[
   {k:'cliente',l:'Cliente',t:'ref',col:'clientes',req:1},{k:'titulo',l:'Escopo',req:1},
   {k:'vertical',l:'Vertical',t:'select',opts:VERTICAIS,req:1},
   {k:'estagio',l:'Estágio',t:'select',opts:['Lead','Visita técnica','Proposta','Negociação','Ganho','Perdido'],req:1},
   {k:'valor',l:'Valor estimado (R$)',t:'money'},
   {k:'canal',l:'Canal de relacionamento',t:'ref',col:'canais',filtro:r=>ativo(r),rotulo:r=>canalRot(r)},
   {k:'campanha',l:'Campanha',t:'ref',col:'campanhas'},{k:'responsavel',l:'Responsável',t:'ref',col:'colaboradores'},
   {k:'proxima_acao',l:'Próxima ação'},{k:'data_prevista',l:'Fechamento previsto',t:'date'},
   {k:'motivo_perda',l:'Motivo da perda (se perdida)',t:'select',opts:MOTIVOS_PERDA}]},
 contratos:{t:'Contrato de manutenção',f:[
   {t:'secao',l:'Manutenção mensal — só para clientes que assinam o plano'},
   {k:'cliente',l:'Cliente',t:'ref',col:'clientes',req:1},campoUnid,{k:'obra',l:'Projeto de origem',t:'ref',col:'obras',lab:'codigo'},
   {k:'plano',l:'Plano',req:1},{k:'valor',l:'Valor mensal (R$)',t:'money',req:1},{k:'dia_venc',l:'Dia de vencimento',t:'number',step:'1'},
   {k:'inicio',l:'Início',t:'date',req:1},{k:'fim',l:'Vigência até',t:'date'},
   campoCL,campoCC,{k:'visitas_mes',l:'Visitas/mês',t:'number',step:'1'},{k:'sla_horas',l:'SLA (horas)',t:'number',step:'1'},
   {k:'reajuste',l:'Índice de reajuste',t:'select',opts:INDICES},{k:'mes_reajuste',l:'Mês do reajuste',t:'select',opts:MESES_OPT},
   {k:'status',l:'Status',t:'select',opts:['Ativo','Suspenso','Encerrado'],req:1},{k:'obs',l:'Observações',t:'textarea'}]},
 contratos_venda:{t:'Contrato de venda',f:[
   {t:'secao',l:'Dados do contrato de prestação de serviços'},
   {k:'objeto',l:'Objeto do contrato',req:1,full:1},
   {k:'prazo_dias',l:'Prazo de execução (dias)',t:'number',step:'1'},{k:'garantia_meses',l:'Garantia dos serviços (meses)',t:'number',step:'1'},
   {k:'foro',l:'Foro (cidade/UF)'},{t:'vazio'},
   {k:'clausulas',l:'Cláusulas adicionais',t:'textarea'},{k:'obs',l:'Observações internas',t:'textarea'}]},
 contratos_forn:{t:'Contrato de fornecedor',f:[
   {t:'secao',l:'Contrato com fornecedor — gera conta a pagar'},
   {k:'fornecedor',l:'Fornecedor',t:'ref',col:'fornecedores',req:1},campoUnid,
   {k:'objeto',l:'Objeto do contrato',req:1,full:1},
   {k:'categoria',l:'Categoria da despesa',t:'select',opts:['Administrativo','Terceiros','Marketing','Impostos','Outros'],req:1},
   Object.assign({},campoCC,{req:1}),
   {k:'obra',l:'Projeto (se a despesa for de um projeto)',t:'ref',col:'obras',lab:'codigo'},{t:'vazio'},
   {t:'secao',l:'Valores e vigência'},
   {k:'valor',l:'Valor por período (R$)',t:'money',req:1},{k:'periodicidade',l:'Periodicidade',t:'select',opts:Object.keys(PERIODOS),req:1},
   {k:'dia_venc',l:'Dia de vencimento',t:'number',step:'1'},{k:'aviso',l:'Aviso prévio para rescisão (dias)',t:'number',step:'1'},
   {k:'inicio',l:'Início',t:'date',req:1},{k:'fim',l:'Vigência até',t:'date'},
   {k:'reajuste',l:'Índice de reajuste',t:'select',opts:INDICES},{k:'mes_reajuste',l:'Mês do reajuste',t:'select',opts:MESES_OPT},
   {k:'status',l:'Status',t:'select',opts:['Ativo','Suspenso','Encerrado'],req:1},{t:'vazio'},
   {k:'obs',l:'Observações',t:'textarea'}]},
 os:{t:'Ordem de serviço',fem:1,f:[
   {k:'cliente',l:'Cliente',t:'ref',col:'clientes',req:1},{k:'obra',l:'Projeto vinculado',t:'ref',col:'obras',lab:'codigo'},
   {k:'tipo',l:'Tipo',t:'select',opts:['Instalação','Manutenção preventiva','Corretiva','Garantia','Visita técnica','Treinamento'],req:1},
   {k:'cobranca',l:'Cobrança',t:'select',opts:COBR_OS,req:1},{k:'valor',l:'Valor a cobrar (R$) — se sob demanda',t:'money'},
   {k:'descricao',l:'Descrição',req:1,full:1},
   {k:'tecnico',l:'Técnico',t:'ref',col:'colaboradores'},{k:'data',l:'Data',t:'date',req:1},
   {k:'hora',l:'Hora'},{k:'duracao',l:'Duração prevista (h)',t:'number',step:'0.5'},
   {k:'prioridade',l:'Prioridade',t:'select',opts:['Baixa','Média','Alta']},
   {k:'status',l:'Status',t:'select',opts:['Agendada','Em execução','Concluída','Cancelada'],req:1},campoUnid,
   {k:'contrato',l:'Contrato de manutenção',t:'ref',col:'contratos',lab:'plano',filtro:c=>ehCtrManut(c)&&c.status==='Ativo'},
   {k:'laudo',l:'Laudo / resultado',t:'textarea'}]},
 agenda:{t:'Compromisso',f:[
   {k:'titulo',l:'Título',req:1},
   {k:'tipo',l:'Tipo',t:'select',opts:['Visita técnica','Reunião','Entrega','Comissionamento','Interno'],req:1},
   {k:'cliente',l:'Cliente',t:'ref',col:'clientes'},{k:'responsavel',l:'Responsável',t:'ref',col:'colaboradores'},
   {k:'data',l:'Data',t:'date',req:1},{k:'hora',l:'Hora'},{k:'local',l:'Local'},{k:'obs',l:'Notas',t:'textarea'}]},
 financeiro:{t:'Lançamento',f:[
   {k:'tipo',l:'Tipo',t:'select',opts:['Receber','Pagar'],req:1},campoUnid,
   {k:'descricao',l:'Descrição',req:1},
   {k:'categoria',l:'Categoria',t:'select',opts:['Serviço','Material','Contrato','Mão de obra','Terceiros',
     'Marketing','Administrativo','Impostos','Outros'],req:1},
   {k:'valor',l:'Valor (R$)',t:'money',req:1},{k:'vencimento',l:'Vencimento',t:'date',req:1},
   {k:'cliente',l:'Cliente',t:'ref',col:'clientes'},{k:'fornecedor',l:'Fornecedor',t:'ref',col:'fornecedores'},
   {k:'obra',l:'Projeto (rateio)',t:'ref',col:'obras',lab:'codigo'},campoCL,campoCC,
   {k:'status',l:'Status',t:'select',opts:['Pendente','Pago','Recebido','Atrasado'],req:1},
   {k:'pagamento',l:'Data de liquidação',t:'date'}]},
 compras:{t:'Pedido de compra',f:[
   {k:'fornecedor',l:'Fornecedor',t:'ref',col:'fornecedores',req:1},campoUnid,
   {k:'obra',l:'Projeto destino',t:'ref',col:'obras',lab:'codigo'},campoCC,
   {k:'descricao',l:'Itens / descrição',req:1,full:1},
   {k:'valor',l:'Valor total (R$)',t:'money',req:1},{k:'emissao',l:'Emissão',t:'date',req:1},
   {k:'previsao',l:'Previsão de entrega',t:'date'},
   {k:'status',l:'Status',t:'select',opts:['Rascunho','Enviado','Confirmado','Recebido','Cancelado'],req:1}]},
 campanhas:{t:'Campanha',fem:1,f:[
   {k:'nome',l:'Nome',req:1},{k:'objetivo',l:'Objetivo'},
   {k:'vertical',l:'Vertical alvo',t:'select',opts:VERTICAIS},
   {k:'canal',l:'Canal de relacionamento',t:'ref',col:'canais',filtro:r=>ativo(r),rotulo:r=>canalRot(r)},{k:'orcamento',l:'Orçamento (R$)',t:'money'},
   {k:'investido',l:'Investido até agora (R$)',t:'money'},{k:'leads',l:'Leads gerados',t:'number',step:'1'},
   {k:'inicio',l:'Início',t:'date'},{k:'fim',l:'Fim',t:'date'},
   {k:'status',l:'Status',t:'select',opts:['Planejada','No ar','Encerrada']}]},
 canais:{t:'Canal',cancelavel:1,unico:['tipo','nome'],f:[
   {k:'tipo',l:'Tipo',t:'select',opts:['Online','Offline'],req:1},{k:'nome',l:'Canal',req:1},
   {k:'descricao',l:'Descrição',full:1}]},
 centros_lucro:{t:'Centro de lucro',cancelavel:1,f:[{k:'codigo',l:'Código'},{k:'nome',l:'Nome',req:1},{k:'descricao',l:'Descrição',full:1}]},
 centros_custo:{t:'Centro de custo',cancelavel:1,f:[{k:'codigo',l:'Código'},{k:'nome',l:'Nome',req:1},{k:'descricao',l:'Descrição',full:1}]},
 familias:{t:'Família',fem:1,cancelavel:1,f:[{k:'nome',l:'Nome',req:1},{k:'descricao',l:'Descrição'}]},
 categorias:{t:'Categoria',fem:1,cancelavel:1,f:[{k:'nome',l:'Nome',req:1},{k:'descricao',l:'Descrição'}]},
 concorrentes:{t:'Concorrente',f:[
   {k:'nome',l:'Empresa',req:1},{k:'atuacao',l:'Atuação'},
   {k:'faixa',l:'Faixa de preço',t:'select',opts:['Baixa','Média','Alta']},
   {k:'fortes',l:'Pontos fortes',t:'textarea'},{k:'fracos',l:'Pontos fracos',t:'textarea'},
   {k:'ultima',l:'Última observação',t:'textarea'}]}
};
function editRec(col,id,after,preset){
  if(col==='produtos')return editarProduto(id,after);
  if(col==='empresas')return editarEmpresa(id,after);
  let sc=SCH[col];if(!sc)return;
  if(col==='contratos'){const base=id?byId(col,id):(preset||{});
    if(base&&base.tipo==='Fornecedor')sc=SCH.contratos_forn;else if(base&&base.subtipo==='Venda')sc=SCH.contratos_venda;
    preset=Object.assign({tipo:(base&&base.tipo)||'Cliente'},(base&&base.tipo==='Fornecedor')||(base&&base.subtipo)?{}:{subtipo:'Manutenção'},preset||{})}
  if(col==='os'&&!id)preset=Object.assign({cobranca:'Sob demanda',status:'Agendada',data:hoje()},preset||{});
  if(!id&&sc.f.some(f=>f.k==='empresa')){preset=Object.assign({empresa:UNID||empresaPadrao()},preset||{})}
  const rec=id?byId(col,id):(preset||{});
  const fim=()=>{closeM();after?after():render()};
  let extra='';
  if(id)extra='<div style="margin-top:6px">'+(sc.cancelavel?
    '<button class="btn '+(ativo(rec)?'dgr':'sec')+' sm" id="mCan">'+(ativo(rec)?'Cancelar '+sc.t.toLowerCase():'Reativar')+'</button>':
    '<button class="btn dgr sm" id="mDel">Excluir registro</button>')+'</div>';
  openM((id?'Editar ':(sc.fem?'Nova ':'Novo '))+sc.t.toLowerCase(),formHtml(sc.f,rec)+extra,'Salvar',d=>{
    if(sc.cancelavel){
      const ch=sc.unico||['nome'],norm=v=>String(v||'').trim().toLowerCase();
      const dup=S[col].find(x=>x.id!==d.id&&ch.every(k=>norm(x[k])===norm(d[k])));
      if(dup){toast(ativo(dup)?'Já existe '+sc.t.toLowerCase()+' com esse nome':'Esse nome existe mas está cancelado — reative-o');return}
      d.nome=String(d.nome).trim();d.status=rec.status||'Ativa';
    }
    put(col,Object.assign({},id?rec:(preset||{}),d));toast('Salvo');fim();
  });
  const b=document.getElementById('mDel');
  if(b)b.onclick=()=>{if(confirm('Excluir definitivamente?')){del(col,id);toast('Excluído');fim()}};
  const c=document.getElementById('mCan');
  if(c)c.onclick=()=>{
    if(ativo(rec)){
      const cen=col.startsWith('centros_'),kc=col==='centros_lucro'?'centro_lucro':'centro_custo';
      const uso=col==='canais'?S.oportunidades.filter(o=>o.canal===id).length:cen?S.obras.filter(o=>o[kc]===id).length:S.produtos.filter(p=>p.familia===id||p.categoria===id).length;
      if(!confirm('Cancelar "'+rec.nome+'"?'+(uso?' '+uso+(col==='canais'?' oportunidade(s)':cen?' projeto(s)':' produto(s)')+' usam este registro e continuam com ele, mas ele deixa de aparecer em novos cadastros.':'')))return;
      rec.status='Cancelada';
    }else rec.status='Ativa';
    put(col,rec);toast(rec.status==='Ativa'?'Reativado':'Cancelado');fim();
  };
}

/* ---------- navegação ---------- */
const NAV=[
 {g:'',i:[['painel','Painel','◧']]},
 {g:'Marketing',i:[['canais','Canais','⌁'],['campanhas','Campanhas','✦'],['marketing','Resultados','◈'],['concorrentes','Concorrência','◐']]},
 {g:'Comercial',i:[['clientes','Clientes','◎'],['oportunidades','Oportunidades','↗'],['orcamentos','Orçamentos','▤'],['vendas','Vendas','✓']]},
 {g:'Operação',i:[['obras','Projetos','⌂'],['os','Ordens de serviço','☎'],['agenda','Agenda','▦']]},
 {g:'Compras',i:[['compras','Pedido de Compra','⇄'],['estoque','Estoque','▣']]},
 {g:'Financeiro',i:[['financeiro','Contas','$'],['fluxo','Fluxo de caixa','≈'],['dre','DRE gerencial','◱']]},
 {g:'Gestão',i:[['contratos','Contratos','⎘']]},
 {g:'Sistema',i:[['cadastros','Cadastros','⚙']]}
];
const SUB={painel:'Visão geral da operação',clientes:'Base, histórico e rentabilidade',
 oportunidades:'Funil comercial por estágio',orcamentos:'Orçamentos híbridos: material + serviço',
 vendas:'Vendas negociadas e fechadas',marketing:'Retorno por canal de relacionamento',
 campanhas:'Campanhas, investimento e leads',canais:'Canais de relacionamento online e offline',
 concorrentes:'Monitoramento da concorrência',obras:'Execução, resultado até a entrega e pós-venda',
 os:'Ordens de serviço, garantia e retrabalho',agenda:'Calendário e capacidade da equipe',
 contratos:'Manutenção recorrente e SLA',estoque:'Multilocal: almoxarifado, técnico e obra',
 compras:'Pedidos, fornecedores e importação de XML',financeiro:'Contas a pagar e a receber',
 fluxo:'Projeção unificada de entradas e saídas',dre:'Resultado gerencial por vertical',
 cadastros:'Produtos, serviços, equipe e locais'};
let route='painel';
function go(k){route=k;document.getElementById('side').classList.remove('open');render();window.scrollTo(0,0)}
function drawNav(){
  const el=document.getElementById('side');
  let h='<div class="logo"><i></i> Ative One</div>';
  NAV.forEach(g=>{
    if(g.g)h+='<div class="ng">'+g.g+'</div>';
    g.i.forEach(it=>{
      const alert=navBadge(it[0]);
      h+='<button class="nav'+(route===it[0]?' on':'')+'" data-go="'+it[0]+'"><span style="width:16px;text-align:center">'+it[2]+'</span>'+it[1]+(alert?'<b>'+alert+'</b>':'')+'</button>';
    });
  });
  h+='<div class="sfoot">Dados salvos automaticamente.<br>Vertical: residencial · predial · corporativo</div>';
  el.innerHTML=h;
  el.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
}
function navBadge(k){
  if(k==='financeiro')return contasVencidas().length||0;
  if(k==='os')return U('os').filter(o=>o.status==='Agendada'&&o.data<hoje()).length||0;
  if(k==='estoque')return alertasEstoque().length||0;
  if(k==='cadastros')return docsAlerta().filter(x=>diasAte(x.doc.validade)<0).length||0;
  return 0;
}
function drawUnid(){
  const el=document.getElementById('unid');if(!el)return;
  const es=S.empresas.filter(e=>ativo(e));
  if(UNID&&!es.some(e=>e.id===UNID))UNID='';
  if(es.length<2){el.style.display='none';UNID='';return}
  const ord=[];es.filter(e=>e.tipo==='Matriz').forEach(m=>{ord.push(m);es.filter(f=>f.matriz===m.id).forEach(f=>ord.push(f))});
  es.filter(e=>!ord.includes(e)).forEach(e=>ord.push(e));
  el.innerHTML='<option value="">Todas as unidades</option>'+ord.map(e=>'<option value="'+e.id+'"'+(UNID===e.id?' selected':'')+'>'+
    (e.tipo==='Filial'?'└ ':'')+esc(e.nome_fantasia||e.razao_social)+'</option>').join('');
  el.style.display='';
  el.onchange=()=>{UNID=el.value;try{localStorage.setItem('ative:unid',UNID)}catch(e){}render()};
}
function render(){
  drawUnid();
  drawNav();
  document.getElementById('ttl').textContent=(NAV.flatMap(g=>g.i).find(i=>i[0]===route)||[,'Painel'])[1];
  document.getElementById('sub').textContent=(SUB[route]||'')+(UNID&&['painel','vendas','orcamentos','obras','os','contratos','estoque','compras','financeiro','fluxo','dre','marketing'].includes(route)?' · '+nomeUnid(UNID):'');
  const v=document.getElementById('view');
  v.innerHTML='';
  (R[route]||R.painel)(v);
}
document.getElementById('burger').onclick=()=>document.getElementById('side').classList.toggle('open');
/* ---------- regras calculadas ---------- */
function saldoProdLocal(pid,lid){return S.estoque.filter(m=>m.produto===pid&&m.local===lid)
  .reduce((a,m)=>a+Number(m.qtd||0),0)}
function saldoProd(pid){return S.estoque.filter(m=>m.produto===pid).reduce((a,m)=>a+Number(m.qtd||0),0)}
function saldoAlmox(pid,emp){if(emp===undefined)emp=UNID;
  const alm=S.locais.filter(l=>l.tipo==='Almoxarifado'&&(!emp||empDe('locais',l)===emp)).map(l=>l.id);
  return S.estoque.filter(m=>m.produto===pid&&alm.includes(m.local)).reduce((a,m)=>a+Number(m.qtd||0),0)}
function reservadoProd(pid,emp){if(emp===undefined)emp=UNID;
  return S.reservas.filter(r=>r.produto===pid&&r.status==='Ativa'&&(!emp||empDe('reservas',r)===emp)).reduce((a,r)=>a+Number(r.qtd||0),0)}
function saldoDisponivel(pid,emp){return saldoAlmox(pid,emp)-reservadoProd(pid,emp)}
function almoxDe(emp){return S.locais.find(l=>l.tipo==='Almoxarifado'&&ativo(l)&&empDe('locais',l)===emp)||S.locais.find(l=>l.tipo==='Almoxarifado')}
function alertasEstoque(){return S.produtos.filter(p=>!ehKit(p)&&Number(p.minimo||0)>0&&saldoDisponivel(p.id)<Number(p.minimo))}
const tipoProd=p=>(p&&p.tipo)||'Simples';
const ehKit=p=>tipoProd(p)==='Kit';
const ativo=r=>!!r&&(!r.status||r.status==='Ativo'||r.status==='Ativa');
const simplesAtivo=p=>!ehKit(p)&&ativo(p);
const nomeClass=(col,v)=>{if(!v)return '—';const r=byId(col,v);return r?r.nome:v};
const rotuloProd=p=>(ehKit(p)?'[Kit] ':'')+(p.sku?p.sku+' · ':'')+p.nome;
function custoProduto(p){if(!p)return 0;if(!ehKit(p))return Number(p.custo||0);
  return (p.componentes||[]).reduce((a,c)=>a+Number(c.qtd||0)*Number((byId('produtos',c.produto)||{}).custo||0),0)}
function vendaComponentes(p){return (p.componentes||[]).reduce((a,c)=>a+Number(c.qtd||0)*Number((byId('produtos',c.produto)||{}).venda||0),0)}
function explodir(pid,q){const p=byId('produtos',pid);
  if(!ehKit(p))return[{produto:pid,qtd:Number(q)}];
  return (p.componentes||[]).map(c=>({produto:c.produto,qtd:Number(c.qtd)*Number(q)}))}
function kitMontavel(p){let n=Infinity,lim=null;
  (p.componentes||[]).forEach(c=>{const d=Math.floor(Math.max(0,saldoDisponivel(c.produto))/Number(c.qtd||1));if(d<n){n=d;lim=c.produto}});
  return{n:n===Infinity?0:n,lim:lim}}
const descComp=p=>(p.componentes||[]).map(c=>num(c.qtd,2)+'× '+nm('produtos',c.produto)).join(' · ');
function custoMaterialObra(oid){return S.estoque.filter(m=>m.obra===oid&&Number(m.qtd)<0)
  .reduce((a,m)=>a+Math.abs(Number(m.qtd||0))*Number(m.custo||0),0)}
function custoMaoObra(oid){return S.apontamentos.filter(a=>a.obra===oid).reduce((acc,a)=>{
  const c=byId('colaboradores',a.colaborador);return acc+Number(a.horas||0)*Number((c&&c.custo_hora)||0)},0)}
function custoTerceiros(oid){return S.financeiro.filter(l=>l.obra===oid&&l.tipo==='Pagar')
  .reduce((a,l)=>a+Number(l.valor||0),0)}
function custoObra(oid){return custoMaterialObra(oid)+custoMaoObra(oid)+custoTerceiros(oid)}
function receitaObra(oid){const r=S.financeiro.filter(l=>l.obra===oid&&l.tipo==='Receber')
  .reduce((a,l)=>a+Number(l.valor||0),0);const o=byId('obras',oid);
  return r>0?r:Number((o&&o.valor)||0)}
function progressoObra(o){const e=o.etapas||[];if(!e.length)return 0;
  return Math.round(e.reduce((a,x)=>a+(x.status==='Concluída'?Number(x.pct||0):0),0))}
function horasObra(oid){return S.apontamentos.filter(a=>a.obra===oid).reduce((a,x)=>a+Number(x.horas||0),0)}
function osDaObra(oid){return S.os.filter(o=>o.obra===oid)}
function rentabilidadeCliente(cid){
  const obras=S.obras.filter(o=>o.cliente===cid);
  let rec=0,cus=0;obras.forEach(o=>{rec+=receitaObra(o.id);cus+=custoObra(o.id)});
  S.vendas.filter(v=>v.cliente===cid&&v.status!=='Cancelada'&&!v.obra).forEach(v=>{rec+=Number(v.valor||0);cus+=Number(v.custo||0)});
  const contr=S.contratos.filter(c=>ehCtrManut(c)&&c.cliente===cid&&c.status==='Ativo').reduce((a,c)=>a+Number(c.valor||0),0);
  return{obras:obras.length,receita:rec,custo:cus,margem:rec>0?(rec-cus)/rec*100:0,recorrente:contr};
}
function orcTotais(o){
  let m={c:0,v:0},s={c:0,v:0};
  (o.itens||[]).forEach(i=>{const q=Number(i.qtd||0),tc=q*Number(i.custo||0),tv=q*Number(i.venda||0);
    if(i.nat==='Serviço'){s.c+=tc;s.v+=tv}else{m.c+=tc;m.v+=tv}});
  const v=m.v+s.v,c=m.c+s.c;
  return{mat:m,serv:s,venda:v,custo:c,margem:v>0?(v-c)/v*100:0};
}
function contasVencidas(){return U('financeiro').filter(l=>l.status!=='Pago'&&l.status!=='Recebido'&&l.vencimento<hoje())}
function chartBars(el,series,labels,colors){
  const max=Math.max(1,...series.flat().map(Math.abs));
  const n=labels.length,gw=560/n,bw=Math.min(38,gw/series.length-4);
  let h='<svg class="ch" viewBox="0 0 600 190" preserveAspectRatio="none"><g>';
  labels.forEach((L,i)=>{
    series.forEach((ser,si)=>{
      const val=ser[i]||0,bh=Math.abs(val)/max*130,
        x=22+i*gw+(gw-bw*series.length)/2+si*bw,y=150-bh;
      h+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+(bw-3).toFixed(1)+'" height="'+bh.toFixed(1)+
        '" rx="3" fill="'+colors[si]+'"></rect>';
    });
    h+='<text x="'+(22+i*gw+gw/2).toFixed(1)+'" y="168" text-anchor="middle" font-size="10" fill="var(--faint)">'+esc(L)+'</text>';
  });
  h+='<line x1="16" y1="150" x2="590" y2="150" stroke="var(--border)"></line></g></svg>';
  el.innerHTML=h;
}

/* ---------- telas ---------- */
const R={};
R.painel=v=>{
  const mes=mesDe(hoje());
  const recMes=U('financeiro').filter(l=>l.tipo==='Receber'&&mesDe(l.vencimento)===mes).reduce((a,l)=>a+Number(l.valor||0),0);
  const pagMes=U('financeiro').filter(l=>l.tipo==='Pagar'&&mesDe(l.vencimento)===mes).reduce((a,l)=>a+Number(l.valor||0),0);
  const ativas=U('obras').filter(o=>o.status==='Em execução');
  const backlog=ativas.reduce((a,o)=>a+Number(o.valor||0),0);
  let mg=0;const enc=U('obras').filter(o=>o.status==='Concluída');
  if(enc.length)mg=enc.reduce((a,o)=>{const r=receitaObra(o.id);return a+(r?(r-custoObra(o.id))/r*100:0)},0)/enc.length;
  const venc=contasVencidas(), alert=alertasEstoque();
  const osHoje=U('os').filter(o=>o.data===hoje());
  const ag=S.agenda.filter(a=>a.data===hoje());
  const vm=U('vendas').filter(x=>x.status!=='Cancelada'&&mesDe(x.data)===mes);
  v.innerHTML='<div class="kpis">'+
   kpi('Vendas no mês',money(vm.reduce((a,x)=>a+Number(x.valor||0),0)),vm.length+' venda(s)')+
   kpi('Projetos em execução',ativas.length,backlog>0?money(backlog)+' em backlog':'')+
   kpi('A receber no mês',money(recMes),'')+
   kpi('A pagar no mês',money(pagMes),'')+
   kpi('Margem média encerradas',enc.length?pct(mg):'—',enc.length+' projetos concluídos')+
   '</div>'+
   '<div class="cols21">'+
     '<div class="card"><div class="chead"><h2>Projetos em andamento</h2></div><div class="cbody" id="pObras"></div></div>'+
     '<div class="card"><div class="chead"><h2>Precisa de atenção</h2></div><div class="cbody" id="pAlert"></div></div>'+
   '</div>'+
   '<div class="cols2">'+
     '<div class="card"><div class="chead"><h2>Hoje</h2><span class="hint">'+dBR(hoje())+'</span></div><div class="cbody" id="pHoje"></div></div>'+
     '<div class="card"><div class="chead"><h2>Funil comercial</h2></div><div class="cbody" id="pFunil"></div></div>'+
   '</div>';
  const po=document.getElementById('pObras');
  po.innerHTML=tbl([{l:'Projeto',s:1,f:r=>esc(r.codigo)+' · '+esc(r.titulo||'')},
    {l:'Cliente',f:r=>esc(nm('clientes',r.cliente))},
    {l:'Progresso',f:r=>{const p=progressoObra(r);const cls=p<40?' b':(p<70?' w':'');
      return '<div class="bar'+cls+'"><i style="width:'+p+'%"></i></div><span style="font-size:11px">'+p+'%</span>'}}],
    ativas,{onRow:id=>abrirObra(id),empty:'Nenhum projeto em execução.'});
  wireTable(po,'obras',{onRow:id=>abrirObra(id)});
  const pa=document.getElementById('pAlert');
  let ah='';
  if(venc.length)ah+='<div style="margin-bottom:9px"><span class="bg g-red">'+venc.length+'</span> contas vencidas · '+
    money(venc.reduce((a,l)=>a+Number(l.valor||0),0))+'</div>';
  if(alert.length)ah+='<div style="margin-bottom:9px"><span class="bg g-amber">'+alert.length+'</span> itens abaixo do mínimo: '+
    esc(alert.slice(0,3).map(p=>p.nome).join(', '))+'</div>';
  const atras=U('os').filter(o=>o.status==='Agendada'&&o.data<hoje());
  if(atras.length)ah+='<div style="margin-bottom:9px"><span class="bg g-red">'+atras.length+'</span> OS agendadas em atraso</div>';
  const gar=U('os').filter(o=>o.tipo==='Garantia'&&o.status!=='Concluída');
  if(gar.length)ah+='<div style="margin-bottom:9px"><span class="bg g-purple">'+gar.length+'</span> atendimentos em garantia abertos</div>';
  const dal=docsAlerta();
  if(dal.length)ah+='<div style="margin-bottom:9px"><span class="bg '+(dal.some(x=>diasAte(x.doc.validade)<0)?'g-red':'g-amber')+'">'+dal.length+
    '</span> documento(s) da empresa vencidos ou vencendo em 30 dias: '+esc(dal.slice(0,2).map(x=>x.doc.tipo+' ('+nomeEmp(x.empresa)+')').join(', '))+'</div>';
  const agAss=U('contratos').filter(c=>ehCtrVenda(c)&&c.status==='Aguardando assinatura');
  if(agAss.length)ah+='<div style="margin-bottom:9px"><span class="bg g-amber">'+agAss.length+'</span> contrato(s) de venda aguardando assinatura: '+
    esc(agAss.slice(0,3).map(c=>c.numero+' '+nm('clientes',c.cliente)).join(', '))+'</div>';
  const semTermo=U('obras').filter(o=>o.entrega&&o.entrega.emitido&&!(o.entrega.anexos||[]).length);
  if(semTermo.length)ah+='<div style="margin-bottom:9px"><span class="bg g-amber">'+semTermo.length+'</span> projeto(s) entregue(s) sem o termo assinado anexado</div>';
  const mesA=mesDe(hoje()),aGerar=U('contratos').filter(c=>c.status==='Ativo'&&ctrVenceNoMes(c,mesA)&&!S.financeiro.some(l=>l.contrato===c.id&&mesDe(l.vencimento)===mesA));
  if(aGerar.length)ah+='<div style="margin-bottom:9px"><span class="bg g-amber">'+aGerar.length+'</span> contrato(s) sem lançamento neste mês ('+
      aGerar.filter(ehCtrManut).length+' de manutenção, '+aGerar.filter(ehCtrForn).length+' de fornecedor)</div>';
  const adp=S.aditivos.filter(a=>a.status==='Pendente');
  if(adp.length)ah+='<div style="margin-bottom:9px"><span class="bg g-amber">'+adp.length+'</span> aditivo(s) aguardando aprovação</div>';
  const prontas=U('obras').filter(o=>o.status==='Em execução'&&(o.etapas||[]).length&&(o.etapas||[]).every(e=>e.status==='Concluída'));
  if(prontas.length)ah+='<div style="margin-bottom:9px"><span class="bg g-brand">'+prontas.length+'</span> projeto(s) prontos para termo de entrega</div>';
  const semSaldo=S.produtos.filter(p=>reservadoProd(p.id)>0&&saldoDisponivel(p.id)<0);
  if(semSaldo.length)ah+='<div style="margin-bottom:9px"><span class="bg g-red">'+semSaldo.length+'</span> item(ns) reservados sem saldo: '+esc(semSaldo.slice(0,3).map(p=>p.nome).join(', '))+'</div>';
  pa.innerHTML=ah||'<div class="empty">Nada pendente.</div>';
  const ph=document.getElementById('pHoje');
  const itens=[...ag.map(a=>({h:a.hora||'—',t:a.titulo,s:a.tipo})),
               ...osHoje.map(o=>({h:o.hora||'—',t:'OS · '+o.descricao,s:o.tipo}))];
  ph.innerHTML=itens.length?itens.sort((a,b)=>a.h.localeCompare(b.h)).map(i=>
    '<div style="display:flex;gap:9px;padding:5px 0;border-bottom:1px solid var(--border)"><b style="font-size:12px;width:44px">'+
    esc(i.h)+'</b><span style="font-size:12.5px">'+esc(i.t)+'</span><span class="bg g-gray" style="margin-left:auto">'+esc(i.s)+'</span></div>').join(''):
    '<div class="empty">Sem compromissos hoje.</div>';
  const est=['Lead','Visita técnica','Proposta','Negociação'];
  document.getElementById('pFunil').innerHTML='<table>'+est.map(e=>{
    const l=S.oportunidades.filter(o=>o.estagio===e);
    return '<tr><td>'+e+'</td><td class="n s">'+l.length+'</td><td class="n">'+money(l.reduce((a,o)=>a+Number(o.valor||0),0))+'</td></tr>'
  }).join('')+'</table>';
};
const kpi=(l,v,d)=>'<div class="kpi"><div class="l">'+esc(l)+'</div><div class="v">'+v+'</div>'+(d?'<div class="d">'+esc(d)+'</div>':'')+'</div>';

R.clientes=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Novo cliente</button>'+
    '<input type="text" id="bus" placeholder="Buscar por nome..."><select id="fv"><option value="">Todas as verticais</option>'+
    VERTICAIS.map(x=>'<option>'+x+'</option>').join('')+'</select></div><div class="card"><div class="cbody" id="lst"></div></div>';
  const draw=()=>{
    const q=(document.getElementById('bus').value||'').toLowerCase(),fv=document.getElementById('fv').value;
    const rows=S.clientes.filter(c=>(!q||String(c.nome||'').toLowerCase().includes(q))&&(!fv||c.vertical===fv));
    const el=document.getElementById('lst');
    el.innerHTML=tbl([{l:'Cliente',k:'nome',s:1},{l:'Vertical',f:r=>'<span class="bg g-accent">'+esc(r.vertical||'—')+'</span>'},
      {l:'Contato',k:'contato'},{l:'Cidade',k:'cidade'},
      {l:'Projetos',n:1,f:r=>rentabilidadeCliente(r.id).obras},
      {l:'Receita',n:1,f:r=>money(rentabilidadeCliente(r.id).receita)},
      {l:'Margem',n:1,f:r=>{const m=rentabilidadeCliente(r.id);return m.receita?'<span class="bg '+(m.margem<25?'g-red':m.margem<35?'g-amber':'g-green')+'">'+pct(m.margem)+'</span>':'—'}}],
      rows,{acts:1,onRow:id=>cliente360(id),empty:'Cadastre o primeiro cliente.'});
    wireTable(el,'clientes',{onRow:id=>cliente360(id)});
  };
  document.getElementById('nv').onclick=()=>editRec('clientes',null);
  document.getElementById('bus').oninput=draw;document.getElementById('fv').onchange=draw;draw();
};
function cliente360(cid){
  const c=byId('clientes',cid);if(!c)return;
  const r=rentabilidadeCliente(cid);
  const obras=S.obras.filter(o=>o.cliente===cid), oss=S.os.filter(o=>o.cliente===cid),
    ops=S.oportunidades.filter(o=>o.cliente===cid), ctr=S.contratos.filter(x=>ehCtrCliente(x)&&x.cliente===cid);
  const gar=oss.filter(o=>o.tipo==='Garantia');
  const custoGar=gar.reduce((a,o)=>a+Number(o.duracao||0)*90,0);
  let h='<div class="kpis" style="margin-bottom:12px">'+
    kpi('Receita total',money(r.receita))+kpi('Custo total',money(r.custo))+
    kpi('Margem',r.receita?pct(r.margem):'—')+kpi('Recorrente/mês',money(r.recorrente))+'</div>';
  h+='<div class="note" style="margin-bottom:12px">'+esc(c.vertical||'')+' · '+esc(c.cidade||'')+
     ' · '+esc(c.contato||'')+' '+esc(c.telefone||'')+'</div>';
  h+='<h4 style="font-size:12px;color:var(--faint);margin:10px 0 5px">PROJETOS</h4>'+
    tbl([{l:'Código',k:'codigo',s:1},{l:'Escopo',k:'titulo'},{l:'Status',f:x=>'<span class="bg '+bgFor(x.status)+'">'+esc(x.status)+'</span>'},
      {l:'Receita',n:1,f:x=>money(receitaObra(x.id))},{l:'Custo',n:1,f:x=>money(custoObra(x.id))},
      {l:'Margem',n:1,f:x=>{const rr=receitaObra(x.id);return rr?pct((rr-custoObra(x.id))/rr*100):'—'}}],obras,{empty:'Sem obras.'});
  h+='<h4 style="font-size:12px;color:var(--faint);margin:14px 0 5px">VENDAS</h4>'+
    tbl([{l:'Nº',k:'numero',s:1},{l:'Data',f:x=>dBR(x.data)},{l:'Tipo',f:x=>x.entrega==='Obra'?'Obra':'Produtos'},
      {l:'Valor',n:1,f:x=>money(x.valor)},{l:'Margem',n:1,f:x=>pct(x.margem)},
      {l:'Status',f:x=>'<span class="bg '+bgFor(x.status)+'">'+esc(x.status)+'</span>'}],S.vendas.filter(x=>x.cliente===cid),{empty:'Sem vendas.'});
  h+='<h4 style="font-size:12px;color:var(--faint);margin:14px 0 5px">OPORTUNIDADES</h4>'+
    tbl([{l:'Escopo',k:'titulo',s:1},{l:'Estágio',k:'estagio'},{l:'Valor',n:1,f:x=>money(x.valor)},{l:'Canal',f:x=>esc(canalNome(x.canal))}],ops,{empty:'Sem oportunidades.'});
  h+='<h4 style="font-size:12px;color:var(--faint);margin:14px 0 5px">CONTRATOS</h4>'+
    tbl([{l:'Tipo',f:x=>ehCtrVenda(x)?'Venda '+esc(x.numero||''):'Manutenção mensal'},{l:'Descrição',s:1,f:x=>esc(x.plano||x.objeto||'')},
      {l:'Valor',n:1,f:x=>money(x.valor)+(ehCtrVenda(x)?'':'/mês')},
      {l:'Status',f:x=>'<span class="bg '+bgCtr(x.status)+'">'+esc(x.status)+'</span>'}],ctr,{empty:'Sem contratos.'});
  h+='<h4 style="font-size:12px;color:var(--faint);margin:14px 0 5px">ATENDIMENTOS</h4>'+
    tbl([{l:'Data',f:x=>dBR(x.data)},{l:'Tipo',f:x=>'<span class="bg '+(x.tipo==='Garantia'?'g-purple':'g-gray')+'">'+esc(x.tipo)+'</span>'},
      {l:'Descrição',k:'descricao'},{l:'Status',f:x=>'<span class="bg '+bgFor(x.status)+'">'+esc(x.status)+'</span>'}],oss,{empty:'Sem atendimentos.'});
  if(gar.length)h+='<div class="note">Este cliente gerou '+gar.length+' atendimento(s) em garantia. Horas de garantia entram no custo do projeto de origem e reduzem a margem real acima.</div>';
  openM(c.nome,h,null,null,true);
}

R.oportunidades=v=>{
  const est=['Lead','Visita técnica','Proposta','Negociação','Ganho'];
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Nova oportunidade</button></div>'+
    '<div class="card"><div class="cbody"><div class="kan" id="kan"></div></div></div>'+
    '<div class="card"><div class="chead"><h2>Lista completa</h2></div><div class="cbody" id="lst"></div></div>';
  document.getElementById('nv').onclick=()=>editRec('oportunidades',null);
  const k=document.getElementById('kan');
  k.innerHTML=est.map(e=>{const l=S.oportunidades.filter(o=>o.estagio===e);
    return '<div class="kc"><h4>'+e+' <span>'+l.length+'</span></h4>'+l.map(o=>
      '<div class="kk" data-id="'+o.id+'"><div class="t">'+esc(nm('clientes',o.cliente))+'</div>'+
      '<div class="m">'+esc(o.titulo||'')+'</div><div class="m">'+money(o.valor)+' · '+esc(canalNome(o.canal))+'</div></div>').join('')+'</div>'
  }).join('');
  k.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>editRec('oportunidades',b.dataset.id));
  const el=document.getElementById('lst');
  el.innerHTML=tbl([{l:'Cliente',s:1,f:r=>esc(nm('clientes',r.cliente))},{l:'Escopo',k:'titulo'},
    {l:'Vertical',k:'vertical'},{l:'Estágio',k:'estagio'},{l:'Valor',n:1,f:r=>money(r.valor)},
    {l:'Canal',f:r=>esc(canalNome(r.canal))},{l:'Previsto',f:r=>dBR(r.data_prevista)}],S.oportunidades,{acts:1,empty:'Sem oportunidades.'});
  wireTable(el,'oportunidades');
};
/* ---------- orçamentos híbridos ---------- */
const orcFechado=o=>['Convertido','Aprovado','Perdido'].includes(o.status);
R.orcamentos=v=>{
  const OR=U('orcamentos');
  const abertos=OR.filter(o=>!orcFechado(o));
  const conv=OR.filter(o=>o.status==='Convertido'||o.status==='Aprovado').length,
    perd=OR.filter(o=>o.status==='Perdido').length;
  v.innerHTML='<div class="kpis">'+kpi('Em aberto',abertos.length,money(abertos.reduce((a,o)=>a+orcTotais(o).venda,0)))+
    kpi('Convertidos em venda',conv)+kpi('Perdidos',perd)+kpi('Taxa de conversão',(conv+perd)?pct(conv/(conv+perd)*100):'—')+'</div>'+
    '<div class="toolbar"><button class="btn" id="nv">+ Novo orçamento</button>'+
    '<select id="fs"><option value="">Todos os status</option><option>Rascunho</option><option>Enviado</option>'+
    '<option>Convertido</option><option>Perdido</option></select></div>'+
    '<div class="card"><div class="cbody" id="lst"></div></div>';
  document.getElementById('nv').onclick=()=>novoOrc();
  const el=document.getElementById('lst');
  const draw=()=>{
  const fs=document.getElementById('fs').value;
  const rows=U('orcamentos').filter(o=>!fs||(o.status||'Rascunho')===fs||(fs==='Convertido'&&o.status==='Aprovado'));
  el.innerHTML=tbl([{l:'Nº',k:'numero',s:1},{l:'Cliente',f:r=>esc(nm('clientes',r.cliente))},
    {l:'Oportunidade',f:r=>r.oportunidade?esc(nm('oportunidades',r.oportunidade,'titulo')):'—'}].concat(colUnid('orcamentos'),[
    {l:'Vertical',k:'vertical'},{l:'Material',n:1,f:r=>money(orcTotais(r).mat.v)},
    {l:'Serviço',n:1,f:r=>money(orcTotais(r).serv.v)},{l:'Total',n:1,f:r=>'<b>'+money(orcTotais(r).venda)+'</b>'},
    {l:'Margem',n:1,f:r=>{const m=orcTotais(r).margem;return '<span class="bg '+(m<25?'g-red':m<32?'g-amber':'g-green')+'">'+pct(m)+'</span>'}},
    {l:'Status',f:r=>{const st=r.status==='Aprovado'?'Convertido':(r.status||'Rascunho');
      return '<span class="bg '+bgFor(st)+'">'+esc(st)+'</span>'+(r.venda?' <span style="font-size:11px">'+esc(nm('vendas',r.venda,'numero'))+'</span>':'')}}]),
    rows,{onRow:id=>editorOrc(id),empty:'Nenhum orçamento. Crie o primeiro.'});
  wireTable(el,'orcamentos',{onRow:id=>editorOrc(id)});
  };
  document.getElementById('fs').onchange=draw;draw();
};
function novoOrc(){
  const n='ORC-'+String(S.orcamentos.length+1).padStart(4,'0');
  const rec=put('orcamentos',{numero:n,data:hoje(),status:'Rascunho',itens:[],empresa:UNID||empresaPadrao(),
    validade:addDias(hoje(),15),vertical:'Residencial'});
  editorOrc(rec.id);
}
function editorOrc(id){
  const o=byId('orcamentos',id);if(!o)return;
  const draw=()=>{
    const t=orcTotais(o);
    const trav=orcFechado(o);
    const ops=S.oportunidades.filter(x=>x.cliente===o.cliente&&(x.estagio!=='Perdido'||x.id===o.oportunidade));
    let h='';
    if(trav)h+='<div style="margin-bottom:12px">'+(o.status==='Perdido'?
      '<span class="bg g-red">Perdido</span> <span class="note">Motivo: '+esc(o.motivo_perda||'—')+'</span>':
      '<span class="bg g-green">Convertido em venda</span> '+(o.venda?'<span class="note">'+esc(nm('vendas',o.venda,'numero'))+'</span>':''))+'</div>';
    h+='<div class="frow">'+
      field({k:'cliente',l:'Cliente',t:'ref',col:'clientes'},o.cliente)+
      field({k:'oportunidade',l:'Oportunidade',t:'select',opts:[{v:'',l:o.cliente?(ops.length?'— escolha —':'Nenhuma oportunidade deste cliente'):'Escolha o cliente primeiro'}]
        .concat(ops.map(x=>({v:x.id,l:x.titulo+' · '+x.estagio})))},o.oportunidade)+'</div>'+
      '<div class="frow">'+field({k:'vertical',l:'Vertical',t:'select',opts:VERTICAIS},o.vertical)+
      field({k:'validade',l:'Validade',t:'date'},o.validade)+'</div>'+
      '<div class="frow">'+(S.empresas.length?field(campoUnid,o.empresa||empresaPadrao()):'<div></div>')+
      (trav?'<div></div>':field({k:'status',l:'Status',t:'select',opts:['Rascunho','Enviado'],req:1},o.status==='Enviado'?'Enviado':'Rascunho'))+'</div>';
    if(!trav)h+='<div style="display:flex;gap:8px;margin:10px 0"><button class="btn sec sm" id="addM">+ Material</button>'+
       '<button class="btn sec sm" id="addS">+ Serviço</button></div>';
    h+='<div class="scr"><table><thead><tr><th>Item</th><th>Nat.</th><th class="n">Qtd</th><th class="n">Custo un.</th>'+
      '<th class="n">Venda un.</th><th class="n">Total</th><th class="n">Marg.</th><th></th></tr></thead><tbody>';
    (o.itens||[]).forEach((i,ix)=>{
      const q=Number(i.qtd||0),tv=q*Number(i.venda||0),tc=q*Number(i.custo||0);
      h+='<tr><td class="s">'+esc(i.desc)+'</td><td><span class="bg '+(i.nat==='Serviço'?'g-brand':'g-accent')+'">'+esc(i.nat)+'</span></td>'+
        '<td class="n"><input type="number" step="0.01" value="'+q+'" data-ix="'+ix+'" data-f="qtd" style="width:76px"></td>'+
        '<td class="n"><input type="number" step="0.01" value="'+Number(i.custo||0)+'" data-ix="'+ix+'" data-f="custo" style="width:92px"></td>'+
        '<td class="n"><input type="number" step="0.01" value="'+Number(i.venda||0)+'" data-ix="'+ix+'" data-f="venda" style="width:92px"></td>'+
        '<td class="n s">'+money(tv)+'</td><td class="n">'+(tv?pct((tv-tc)/tv*100):'—')+'</td>'+
        '<td class="n"><button class="btn sec sm" data-rm="'+ix+'">×</button></td></tr>';
    });
    h+='</tbody><tfoot>'+
      '<tr><td colspan="5">Material</td><td class="n">'+money(t.mat.v)+'</td><td class="n">'+(t.mat.v?pct((t.mat.v-t.mat.c)/t.mat.v*100):'—')+'</td><td></td></tr>'+
      '<tr><td colspan="5">Serviço</td><td class="n">'+money(t.serv.v)+'</td><td class="n">'+(t.serv.v?pct((t.serv.v-t.serv.c)/t.serv.v*100):'—')+'</td><td></td></tr>'+
      '<tr><td colspan="5">Total do orçamento</td><td class="n">'+money(t.venda)+'</td><td class="n"><span class="bg '+
        (t.margem<25?'g-red':t.margem<32?'g-amber':'g-green')+'">'+pct(t.margem)+'</span></td><td></td></tr>'+
      '</tfoot></table></div>';
    if(t.margem<30&&t.venda>0)h+='<div class="note" style="color:var(--amber)">Margem abaixo de 30% — pela regra do BPM este orçamento exige aprovação antes do envio.</div>';
    h+='<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'+(trav?
      (o.venda?'<button class="btn sec" id="vv">Ver venda</button>':'')+
      (o.status==='Perdido'?'<button class="btn sec" id="ra">Reabrir orçamento</button>':''):
      '<button class="btn sec" id="sv">Salvar</button><button class="btn" id="cv">Converter em venda</button>'+
      '<button class="btn sec" id="pd">Marcar como perdido</button><button class="btn dgr sm" id="rm">Excluir</button>')+'</div>';
    modal.className='wide';
    modal.innerHTML='<div class="mhead"><h3>'+esc(o.numero)+'</h3><button class="x" onclick="closeM()">&times;</button></div><div class="mbody">'+h+'</div>';
    ovl.classList.add('on');
    if(trav){modal.querySelectorAll('.mbody input,.mbody select').forEach(el=>el.disabled=true);
      modal.querySelectorAll('[data-rm]').forEach(b=>b.style.display='none')}
    modal.querySelectorAll('[data-k]').forEach(el=>el.onchange=()=>{
      const k=el.dataset.k;o[k]=el.value;
      if(k==='cliente'){o.oportunidade='';const c=byId('clientes',o.cliente);if(c&&c.vertical)o.vertical=c.vertical}
      if(k==='oportunidade'){const op=byId('oportunidades',o.oportunidade);if(op&&op.vertical)o.vertical=op.vertical}
      if(k==='status'&&o.status==='Enviado'){const op=byId('oportunidades',o.oportunidade);
        if(op&&(op.estagio==='Lead'||op.estagio==='Visita técnica')){op.estagio='Proposta';put('oportunidades',op)}}
      put('orcamentos',o);if(k==='cliente'||k==='oportunidade')draw()});
    modal.querySelectorAll('[data-ix]').forEach(el=>el.onchange=()=>{
      o.itens[Number(el.dataset.ix)][el.dataset.f]=Number(el.value);put('orcamentos',o);draw()});
    modal.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{o.itens.splice(Number(b.dataset.rm),1);put('orcamentos',o);draw()});
    const q=i=>document.getElementById(i);
    if(q('addM'))q('addM').onclick=()=>addItem('Material');
    if(q('addS'))q('addS').onclick=()=>addItem('Serviço');
    if(q('sv'))q('sv').onclick=()=>{put('orcamentos',o);closeM();toast('Orçamento salvo');render()};
    if(q('cv'))q('cv').onclick=()=>registrarVenda(o.id);
    if(q('pd'))q('pd').onclick=()=>perderOrc(o);
    if(q('vv'))q('vv').onclick=()=>abrirVenda(o.venda);
    if(q('ra'))q('ra').onclick=()=>{o.status='Enviado';o.motivo_perda='';put('orcamentos',o);toast('Orçamento reaberto');draw()};
    if(q('rm'))q('rm').onclick=()=>{if(confirm('Excluir orçamento?')){del('orcamentos',o.id);closeM();render()}};
  };
  const addItem=nat=>{
    const col=nat==='Material'?'produtos':'servicos';
    const lista=S[col].filter(ativo).sort((a,b)=>String(a.nome).localeCompare(String(b.nome)));
    if(!lista.length){toast('Cadastre '+(nat==='Material'?'produtos':'serviços')+' primeiro');return}
    const sel='<label class="f"><span>Selecione</span><select id="pick">'+lista.map(p=>
      '<option value="'+p.id+'">'+esc(nat==='Material'?rotuloProd(p):p.nome)+'</option>').join('')+'</select></label>'+
      '<label class="f"><span>Quantidade</span><input type="number" step="0.01" id="qtd" value="1"></label>';
    openM('Adicionar '+nat.toLowerCase(),sel,'Adicionar',()=>{
      const p=byId(col,document.getElementById('pick').value);
      const q=Number(document.getElementById('qtd').value||1);
      o.itens=o.itens||[];
      o.itens.push({nat:nat,ref:p.id,desc:(ehKit(p)?'[Kit] ':'')+p.nome,qtd:q,
        custo:nat==='Material'?custoProduto(p):Number(p.custo||0),venda:Number(p.venda||0)});
      put('orcamentos',o);draw();
    });
  };
  draw();
}
function perderOrc(o){
  const op=byId('oportunidades',o.oportunidade);
  const body=field({k:'motivo',l:'Motivo da perda',t:'select',opts:MOTIVOS_PERDA,req:1},'Preço')+
    field({k:'obs',l:'Detalhes (opcional)',t:'textarea'},'')+
    (op?'<label class="ck" style="border:none"><input type="checkbox" id="opPerd" checked><span>Marcar também a oportunidade "'+esc(op.titulo)+'" como perdida</span></label>':'');
  openM('Orçamento perdido · '+o.numero,body,'Confirmar',d=>{
    o.status='Perdido';o.motivo_perda=d.motivo;o.obs_perda=d.obs;o.perdido_em=hoje();put('orcamentos',o);
    const cb=document.getElementById('opPerd');
    if(op&&cb&&cb.checked){op.estagio='Perdido';op.motivo_perda=d.motivo;put('oportunidades',op)}
    closeM();toast('Orçamento marcado como perdido');render();
  });
}
function gerarParcelas(valor,entradaPct,n,intervalo,primeiro,dataVenda){
  const r2=x=>Math.round(x*100)/100, out=[];
  const ent=r2(valor*Math.min(100,Math.max(0,entradaPct))/100);
  if(ent>0)out.push({desc:'entrada',valor:ent,venc:dataVenda});
  const resto=r2(valor-ent);
  if(resto>0&&n>0){const cada=r2(resto/n);
    for(let i=0;i<n;i++)out.push({desc:'parcela '+(i+1)+'/'+n,valor:i===n-1?r2(resto-cada*(n-1)):cada,venc:addDias(primeiro,i*intervalo)})}
  return out;
}
function registrarVenda(orcId){
  const o=byId('orcamentos',orcId);if(!o)return;
  if(!o.cliente){toast('Defina o cliente no orçamento');return}
  if(!(o.itens||[]).length){toast('O orçamento não tem itens');return}
  const c=byId('clientes',o.cliente)||{}, t=orcTotais(o);
  const temServ=(o.itens||[]).some(i=>i.nat==='Serviço');
  const defCL=ent=>{const L=S.centros_lucro.filter(ativo);const nomeAlvo=ent==='Obra'?o.vertical:'Revenda de produtos';
    const m=L.find(x=>String(x.nome).toLowerCase()===String(nomeAlvo||'').toLowerCase());return m?m.id:''};
  const defCC=()=>{const m=S.centros_custo.filter(ativo).find(x=>/instala/i.test(x.nome));return m?m.id:''};
  const st={centro_lucro:defCL(temServ?'Obra':'Produtos'),centro_custo:defCC(),_ent:temServ?'Obra':'Produtos',empresa:o.empresa||UNID||empresaPadrao(),data:hoje(),vendedor:'',desconto:0,entrega:temServ?'Obra':'Produtos',cobranca:'Parcelas',forma:'PIX',
    entrada:30,n:2,intervalo:30,primeiro:addDias(hoje(),30),documento:c.documento||'',endereco:c.endereco||'',
    pessoa:c.pessoa||'',obs:''};
  const ler=()=>modal.querySelectorAll('[data-v]').forEach(el=>{st[el.dataset.v]=el.type==='number'?Number(el.value||0):el.value});
  const draw=()=>{
    if(st._ent!==st.entrega){st._ent=st.entrega;st.centro_lucro=defCL(st.entrega)||st.centro_lucro}
    const valor=Math.max(0,t.venda-Number(st.desconto||0)), m=valor?(valor-t.custo)/valor*100:0;
    const medicao=st.entrega==='Obra'&&st.cobranca==='Medição';
    const parc=gerarParcelas(valor,Number(st.entrada||0),medicao?0:Math.max(1,Number(st.n||1)),Number(st.intervalo||30),st.primeiro,st.data);
    const inp=(k,l,tp,extra)=>'<label class="f"><span>'+l+'</span><input type="'+(tp||'text')+'" data-v="'+k+'" value="'+esc(st[k])+'"'+(extra||'')+'></label>';
    const sel=(k,l,ops)=>'<label class="f"><span>'+l+'</span><select data-v="'+k+'">'+ops.map(x=>{const v=typeof x==='object'?x.v:x,lb=typeof x==='object'?x.l:x;
      return '<option value="'+esc(v)+'"'+(String(st[k])===String(v)?' selected':'')+'>'+esc(lb)+'</option>'}).join('')+'</select></label>';
    let h='<div class="kpis" style="margin-bottom:12px">'+kpi('Orçamento '+o.numero,money(t.venda))+kpi('Valor fechado',money(valor))+
      kpi('Margem final','<span style="color:'+(m<30?'var(--red)':'inherit')+'">'+pct(m)+'</span>')+kpi('Cliente',esc(c.nome||'—'))+'</div>';
    h+='<div class="fsec">Negociação</div><div class="frow">'+inp('data','Data da venda','date')+
      sel('vendedor','Vendedor',[{v:'',l:'—'}].concat(S.colaboradores.map(x=>({v:x.id,l:x.nome}))))+'</div>'+
      (S.empresas.length?'<div class="frow">'+sel('empresa','Unidade que vendeu',S.empresas.filter(e=>ativo(e)).map(e=>({v:e.id,l:(e.nome_fantasia||e.razao_social)+' · '+e.tipo})))+'<div></div></div>':'')+
      '<div class="frow">'+inp('desconto','Desconto negociado (R$)','number',' step="0.01"')+
      sel('entrega','Tipo de venda',[{v:'Obra',l:'Projeto com execução (abre projeto)'},{v:'Produtos',l:'Somente produtos (baixa do estoque)'}])+'</div>';
    const CLs=S.centros_lucro.filter(ativo),CCs=S.centros_custo.filter(ativo);
    h+='<div class="frow">'+sel('centro_lucro','Centro de lucro *',[{v:'',l:CLs.length?'— escolha —':'Cadastre em Cadastros'}].concat(CLs.map(x=>({v:x.id,l:rotCentro(x)}))))+
      (st.entrega==='Obra'?sel('centro_custo','Centro de custo do projeto *',[{v:'',l:CCs.length?'— escolha —':'Cadastre em Cadastros'}].concat(CCs.map(x=>({v:x.id,l:rotCentro(x)})))):'<div></div>')+'</div>';
    if(m<30&&valor>0)h+='<div class="note" style="color:var(--amber);margin-top:-4px">Margem abaixo de 30%. A venda será registrada com essa sinalização.</div>';
    h+='<div class="fsec">Pagamento</div><div class="frow">'+
      sel('forma','Forma de pagamento',['PIX','Boleto','Cartão de crédito','Transferência','Dinheiro','Financiamento'])+
      (st.entrega==='Obra'?sel('cobranca','Cobrança',[{v:'Parcelas',l:'Parcelas por data'},{v:'Medição',l:'Por medição das etapas do projeto'}]):'<div></div>')+'</div>'+
      '<div class="frow">'+inp('entrada','Entrada (%)','number',' step="1" min="0" max="100"')+
      (medicao?'<div></div>':inp('n','Nº de parcelas após a entrada','number',' step="1" min="1"'))+'</div>'+
      (medicao?'':'<div class="frow">'+inp('intervalo','Intervalo entre parcelas (dias)','number',' step="1"')+inp('primeiro','1º vencimento','date')+'</div>');
    h+='<div class="scr" style="margin-bottom:6px"><table><thead><tr><th>Lançamento</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>'+
      parc.map(x=>'<tr><td>'+esc(x.desc)+'</td><td>'+dBR(x.venc)+'</td><td class="n">'+money(x.valor)+'</td></tr>').join('')+
      (medicao?'<tr><td colspan="2">Saldo por medição das etapas</td><td class="n">'+money(valor-parc.reduce((a,x)=>a+x.valor,0))+'</td></tr>':'')+
      '</tbody></table></div>';
    h+='<div class="fsec">Dados do cliente para faturamento</div><div class="frow">'+
      sel('pessoa','Tipo de pessoa',[{v:'',l:'—'},'Física','Jurídica'])+inp('documento','CPF / CNPJ *')+'</div>'+
      inp('endereco','Endereço completo *')+
      '<label class="f"><span>Observações da venda</span><textarea data-v="obs">'+esc(st.obs)+'</textarea></label>';
    modal.className='wide';
    modal.innerHTML='<div class="mhead"><h3>Registrar venda · '+esc(o.numero)+'</h3><button class="x" onclick="closeM()">&times;</button></div>'+
      '<div class="mbody">'+h+'</div><div class="mfoot"><button class="btn sec" onclick="closeM()">Fechar</button>'+
      '<button class="btn" id="vSv">Confirmar venda</button></div>';
    ovl.classList.add('on');
    modal.querySelectorAll('[data-v]').forEach(el=>el.onchange=()=>{ler();draw()});
    document.getElementById('vSv').onclick=()=>{ler();confirmarVenda(o,st,valor,parc,medicao)};
  };
  draw();
}
function confirmarVenda(o,st,valor,parc,medicao){
  if(!String(st.documento).trim()||!String(st.endereco).trim()){toast('Informe CPF/CNPJ e endereço do cliente');return}
  if(S.centros_lucro.some(ativo)&&!st.centro_lucro){toast('Escolha o centro de lucro');return}
  if(st.entrega==='Obra'&&S.centros_custo.some(ativo)&&!st.centro_custo){toast('Escolha o centro de custo do projeto');return}
  const t=orcTotais(o), c=byId('clientes',o.cliente);
  c.documento=st.documento;c.endereco=st.endereco;if(st.pessoa)c.pessoa=st.pessoa;put('clientes',c);
  const op=byId('oportunidades',o.oportunidade)||S.oportunidades.find(x=>x.cliente===o.cliente&&!['Ganho','Perdido'].includes(x.estagio));
  const num='VD-'+String(S.vendas.length+1).padStart(4,'0');
  const emp=st.empresa||empresaPadrao();
  const v=put('vendas',{numero:num,empresa:emp,centro_lucro:st.centro_lucro||'',centro_custo:st.entrega==='Obra'?(st.centro_custo||''):'',data:st.data,orcamento:o.id,cliente:o.cliente,oportunidade:op?op.id:'',
    canal:op?op.canal:'',vertical:o.vertical,vendedor:st.vendedor,itens:JSON.parse(JSON.stringify(o.itens||[])),
    valor_bruto:t.venda,desconto:Number(st.desconto||0),valor:valor,custo:t.custo,margem:valor?(valor-t.custo)/valor*100:0,
    entrega:st.entrega,cobranca:st.entrega==='Obra'?st.cobranca:'Parcelas',forma:st.forma,obs:st.obs,status:'Fechada'});
  let obra=null,falta=0;
  if(st.entrega==='Obra'){
    const cod='PRJ-'+String(S.obras.length+1).padStart(4,'0');
    const ent=parc.filter(x=>x.desc==='entrada').reduce((a,x)=>a+x.valor,0);
    obra=put('obras',{codigo:cod,empresa:emp,centro_lucro:st.centro_lucro||'',centro_custo:st.centro_custo||'',cliente:o.cliente,titulo:(op?op.titulo:'Projeto '+o.numero),vertical:o.vertical,
      valor:valor,orcado_material:t.mat.c,orcado_mo:t.serv.c,orcamento:o.id,venda:v.id,inicio:st.data,
      fim_prev:addDias(st.data,45),status:'Em execução',cobranca:medicao?'medicao':'parcelas',base_medicao:valor-ent,
      etapas:[{nome:'Projeto executivo',pct:15,status:'Pendente'},{nome:'Compra de material',pct:0,status:'Pendente'},
        {nome:'Infra e cabeamento',pct:30,status:'Pendente'},{nome:'Instalação de módulos',pct:25,status:'Pendente'},
        {nome:'Programação',pct:15,status:'Pendente'},{nome:'Comissionamento e entrega',pct:15,status:'Pendente'}]});
    (o.itens||[]).filter(i=>i.nat==='Material'&&i.ref&&byId('produtos',i.ref)).forEach(i=>{
      const kit=ehKit(byId('produtos',i.ref))?i.ref:'';
      explodir(i.ref,i.qtd||0).forEach(x=>{if(saldoDisponivel(x.produto,emp)<x.qtd)falta++;
        put('reservas',{obra:obra.id,produto:x.produto,qtd:x.qtd,status:'Ativa',data:st.data,kit:kit})});
    });
    v.obra=obra.id;put('vendas',v);
  }else{
    const alm=almoxDe(emp);
    (o.itens||[]).filter(i=>i.nat==='Material'&&i.ref&&byId('produtos',i.ref)).forEach(i=>{
      explodir(i.ref,i.qtd||0).forEach(x=>{const p=byId('produtos',x.produto);
        if(saldoDisponivel(x.produto,emp)<x.qtd)falta++;
        if(alm)put('estoque',{produto:x.produto,local:alm.id,qtd:-x.qtd,tipo:'Venda',data:st.data,custo:Number((p&&p.custo)||0),doc:'Venda '+num,venda:v.id})});
    });
  }
  parc.forEach(x=>put('financeiro',{tipo:'Receber',descricao:num+' · '+x.desc,categoria:st.entrega==='Obra'?'Serviço':'Material',
    valor:x.valor,vencimento:x.venc,cliente:o.cliente,obra:obra?obra.id:'',venda:v.id,empresa:emp,forma:st.forma,status:'Pendente'}));
  const nct='CT-'+String(S.contratos.filter(ehCtrVenda).length+1).padStart(4,'0');
  const ctv=put('contratos',{tipo:'Cliente',subtipo:'Venda',numero:nct,cliente:o.cliente,empresa:emp,venda:v.id,obra:obra?obra.id:'',
    objeto:(op?op.titulo:'Fornecimento de equipamentos e serviços conforme orçamento '+o.numero),valor:valor,desconto:Number(st.desconto||0),
    forma:st.forma,cobranca:v.cobranca,parcelas:parc.map(x=>({desc:x.desc,valor:x.valor,venc:x.venc})),
    prazo_dias:obra?45:0,garantia_meses:12,foro:'',data_venda:st.data,centro_lucro:st.centro_lucro||'',status:'Aguardando assinatura'});
  v.contrato=ctv.id;put('vendas',v);
  o.status='Convertido';o.venda=v.id;o.empresa=emp;put('orcamentos',o);
  if(op){op.estagio='Ganho';op.valor=valor;put('oportunidades',op)}
  closeM();
  toast(num+' registrada · contrato '+nct+' gerado'+(obra?' · projeto '+obra.codigo+' aberto':' · estoque baixado')+(falta?' · '+falta+' item(ns) sem saldo':''));
  route='vendas';render();
}
R.vendas=v=>{
  const mes=mesDe(hoje()), ok=U('vendas').filter(x=>x.status!=='Cancelada'), mesV=ok.filter(x=>mesDe(x.data)===mes);
  const tot=mesV.reduce((a,x)=>a+Number(x.valor||0),0);
  v.innerHTML='<div class="kpis">'+kpi('Vendas no mês',mesV.length,money(tot))+
    kpi('Ticket médio',mesV.length?money(tot/mesV.length):'—')+
    kpi('Margem média',ok.length?pct(ok.reduce((a,x)=>a+Number(x.margem||0),0)/ok.length):'—')+
    kpi('Total vendido',money(ok.reduce((a,x)=>a+Number(x.valor||0),0)),ok.length+' vendas')+'</div>'+
    '<div class="toolbar"><button class="btn" id="nv">+ Registrar venda</button>'+
    '<select id="fv"><option value="">Todas as verticais</option>'+VERTICAIS.map(x=>'<option>'+x+'</option>').join('')+'</select>'+
    '<select id="fs"><option value="">Fechadas e canceladas</option><option>Fechada</option><option>Cancelada</option></select></div>'+
    '<div class="card"><div class="cbody" id="lst"></div></div>';
  document.getElementById('nv').onclick=()=>{
    const ab=U('orcamentos').filter(o=>!orcFechado(o)&&(o.itens||[]).length);
    if(!ab.length){toast('Nenhum orçamento em aberto. A venda nasce de um orçamento.');return}
    openM('Registrar venda','<label class="f"><span>A partir de qual orçamento</span><select id="pkO">'+ab.map(o=>
      '<option value="'+o.id+'">'+esc(o.numero+' · '+nm('clientes',o.cliente)+' · '+money(orcTotais(o).venda))+'</option>').join('')+'</select></label>'+
      '<div class="note">A venda registra o que foi negociado e fechado a partir do orçamento: desconto final, forma de pagamento e parcelas.</div>',
      'Continuar',()=>registrarVenda(document.getElementById('pkO').value));
  };
  const el=document.getElementById('lst');
  const draw=()=>{
    const fv=document.getElementById('fv').value,fs=document.getElementById('fs').value;
    const rows=U('vendas').filter(x=>(!fv||x.vertical===fv)&&(!fs||x.status===fs)).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
    el.innerHTML=tbl([{l:'Nº',k:'numero',s:1},{l:'Data',f:r=>dBR(r.data)},{l:'Cliente',f:r=>esc(nm('clientes',r.cliente))}].concat(colUnid('vendas'),[
      {l:'Vertical',k:'vertical'},{l:'Tipo',f:r=>r.entrega==='Obra'?'Projeto '+esc(nm('obras',r.obra,'codigo')):'Produtos'},
      {l:'Canal',f:r=>esc(canalNome(r.canal))},{l:'Valor',n:1,f:r=>'<b>'+money(r.valor)+'</b>'},
      {l:'Margem',n:1,f:r=>'<span class="bg '+(r.margem<25?'g-red':r.margem<32?'g-amber':'g-green')+'">'+pct(r.margem)+'</span>'},
      {l:'Pagamento',f:r=>esc(r.forma||'—')+(r.cobranca==='Medição'?' · medição':'')},
      {l:'Status',f:r=>'<span class="bg '+bgFor(r.status)+'">'+esc(r.status)+'</span>'}]),
      rows,{onRow:abrirVenda,empty:'Nenhuma venda registrada. Converta um orçamento em venda.'});
    wireTable(el,'vendas',{onRow:abrirVenda});
  };
  document.getElementById('fv').onchange=draw;document.getElementById('fs').onchange=draw;draw();
};
function lancVenda(v){return S.financeiro.filter(l=>l.venda===v.id||(!l.venda&&v.obra&&l.obra===v.obra&&l.tipo==='Receber'))}
function abrirVenda(id){
  const v=byId('vendas',id);if(!v)return;
  const ls=lancVenda(v).filter(l=>l.tipo==='Receber').sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
  const receb=ls.filter(l=>l.status==='Recebido').reduce((a,l)=>a+Number(l.valor||0),0);
  let h='<div class="kpis" style="margin-bottom:12px">'+kpi('Valor fechado',money(v.valor),v.desconto?'desconto '+money(v.desconto):'')+
    kpi('Margem',pct(v.margem))+kpi('Recebido',money(receb))+kpi('A receber',money(ls.filter(l=>l.status!=='Recebido').reduce((a,l)=>a+Number(l.valor||0),0)))+'</div>'+
    '<div class="note" style="margin-bottom:10px">'+dBR(v.data)+' · '+esc(nm('clientes',v.cliente))+' · '+esc(v.vertical||'')+
    (S.empresas.length?' · '+esc(nomeUnid(empDe('vendas',v))):'')+' · vendedor '+esc(nm('colaboradores',v.vendedor))+' · canal '+esc(canalNome(v.canal))+' · orçamento '+esc(nm('orcamentos',v.orcamento,'numero'))+'</div>';
  h+='<div class="fsec">Itens</div>'+tbl([{l:'Item',k:'desc',s:1},{l:'Natureza',k:'nat'},{l:'Qtd',n:1,f:i=>num(i.qtd,2)},
    {l:'Total',n:1,f:i=>money(Number(i.qtd||0)*Number(i.venda||0))}],(v.itens||[]).map((i,ix)=>Object.assign({id:'i'+ix},i)));
  h+='<div class="fsec">Recebimentos</div>'+tbl([{l:'Lançamento',k:'descricao',s:1},{l:'Vencimento',f:l=>dBR(l.vencimento)},
    {l:'Valor',n:1,f:l=>money(l.valor)},{l:'Status',f:l=>'<span class="bg '+bgFor(l.status)+'">'+esc(l.status)+'</span>'}],ls,
    {empty:v.cobranca==='Medição'?'Os recebimentos são gerados ao concluir as etapas do projeto.':'Sem lançamentos.'});
  if(v.obs)h+='<div class="note">'+esc(v.obs)+'</div>';
  const cv=S.contratos.find(c=>c.venda===v.id&&ehCtrVenda(c));
  if(cv)h+='<div class="note" style="margin-top:10px">Contrato '+esc(cv.numero)+' · <span class="bg '+bgCtr(cv.status)+'">'+esc(cv.status)+'</span></div>';
  h+='<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+(cv?'<button class="btn sec sm" id="vCt">Ver contrato</button>':'')+(v.obra?'<button class="btn sec sm" id="vOb">Abrir projeto</button>':'')+
    (v.status!=='Cancelada'?'<button class="btn dgr sm" id="vCa">Cancelar venda</button>':'<span class="bg g-red">Cancelada em '+dBR(v.cancelada_em)+'</span>')+'</div>';
  openM(v.numero+' · '+nm('clientes',v.cliente),h,null,null,true);
  const ob=document.getElementById('vOb');if(ob)ob.onclick=()=>abrirObra(v.obra);
  const vc=document.getElementById('vCt');if(vc)vc.onclick=()=>abrirContratoVenda(cv.id);
  const ca=document.getElementById('vCa');if(ca)ca.onclick=()=>cancelarVenda(v);
}
function cancelarVenda(v){
  const ls=lancVenda(v).filter(l=>l.tipo==='Receber');
  const rec=ls.filter(l=>l.status==='Recebido');
  const obra=v.obra?byId('obras',v.obra):null;
  const execucao=obra&&(horasObra(obra.id)>0||custoMaterialObra(obra.id)>0);
  if(!confirm('Cancelar '+v.numero+'?\n\n• Parcelas pendentes serão removidas'+(rec.length?'\n• '+money(rec.reduce((a,l)=>a+Number(l.valor||0),0))+' já recebidos continuam lançados — trate a devolução no Financeiro':'')+
    (obra?'\n• O projeto '+obra.codigo+' será cancelado e as reservas liberadas'+(execucao?' (atenção: ele já tem horas ou material lançados)':''):'\n• Os produtos baixados voltam ao estoque')+
    '\n• O contrato da venda será cancelado'+'\n• O orçamento volta para Enviado'))return;
  ls.filter(l=>l.status!=='Recebido').forEach(l=>del('financeiro',l.id));
  if(obra){obra.status='Cancelada';put('obras',obra);
    S.reservas.filter(r=>r.obra===obra.id&&r.status==='Ativa').forEach(r=>{r.status='Liberada';put('reservas',r)})}
  else S.estoque.filter(m=>m.venda===v.id&&Number(m.qtd)<0).forEach(m=>put('estoque',{produto:m.produto,local:m.local,qtd:Math.abs(m.qtd),
    tipo:'Estorno',data:hoje(),custo:m.custo,doc:'Cancelamento '+v.numero,venda:v.id}));
  v.status='Cancelada';v.cancelada_em=hoje();put('vendas',v);
  S.contratos.filter(c=>c.venda===v.id&&ehCtrVenda(c)).forEach(c=>{c.status='Cancelado';put('contratos',c)});
  const o=byId('orcamentos',v.orcamento);if(o){o.status='Enviado';o.venda='';put('orcamentos',o)}
  const op=byId('oportunidades',v.oportunidade);if(op){op.estagio='Negociação';put('oportunidades',op)}
  closeM();toast(v.numero+' cancelada');render();
}

/* ---------- obras ---------- */
R.obras=v=>{
  v.innerHTML='<div class="toolbar"><select id="fs"><option value="">Todos os status</option>'+
    ['Em execução','Concluída','Pausada','Cancelada'].map(x=>'<option>'+x+'</option>').join('')+'</select>'+
    '<select id="fv"><option value="">Todas as verticais</option>'+VERTICAIS.map(x=>'<option>'+x+'</option>').join('')+'</select>'+
    '<select id="fc"><option value="">Todos os centros de lucro</option>'+S.centros_lucro.map(c=>'<option value="'+c.id+'">'+esc(rotCentro(c))+'</option>').join('')+'</select></div>'+
    '<div class="kpis" id="kp"></div><div class="card"><div class="cbody" id="lst"></div></div>';
  const draw=()=>{
    const fs=document.getElementById('fs').value,fv=document.getElementById('fv').value;
    const fc=document.getElementById('fc').value;
    const rows=U('obras').filter(o=>(!fs||o.status===fs)&&(!fv||o.vertical===fv)&&(!fc||centroDe('lucro','obras',o)===fc));
    const RS={};rows.forEach(o=>RS[o.id]=resultadoProjeto(o));
    const tot=rows.reduce((t,o)=>({e:t.e+RS[o.id].entrega.res,c:t.c+RS[o.id].ciclo.res,r:t.r+RS[o.id].ciclo.rec}),{e:0,c:0,r:0});
    document.getElementById('kp').innerHTML=kpi('Projetos',rows.length,rows.filter(o=>o.status==='Em execução').length+' em execução')+
      kpi('Contratado',money(rows.reduce((a,o)=>a+Number(o.valor||0),0)))+
      kpi('Resultado até a entrega',money(tot.e))+kpi('Resultado ciclo completo',money(tot.c),tot.r?'margem '+pct(tot.c/tot.r*100):'');
    const el=document.getElementById('lst');
    el.innerHTML=tbl([{l:'Código',k:'codigo',s:1},{l:'Cliente',f:r=>esc(nm('clientes',r.cliente))}].concat(colUnid('obras'),[
      {l:'Vertical',f:r=>'<span class="bg g-accent">'+esc(r.vertical||'—')+'</span>'},
      {l:'Centro de lucro',f:r=>'<span style="font-size:12px">'+esc(nomeCentro('lucro',centroDe('lucro','obras',r)))+'</span>'},
      {l:'Contratado',n:1,f:r=>money(r.valor)},
      {l:'Até a entrega',n:1,f:r=>money(RS[r.id].entrega.res)+' '+badgeMg(RS[r.id].mEntrega)},
      {l:'Ciclo completo',n:1,f:r=>money(RS[r.id].ciclo.res)+' '+badgeMg(RS[r.id].mCiclo)},
      {l:'Progresso',f:r=>{const p=progressoObra(r);return '<div class="bar'+(p<40?' b':p<70?' w':'')+'"><i style="width:'+p+'%"></i></div>'}},
      {l:'Status',f:r=>'<span class="bg '+bgFor(r.status)+'">'+esc(r.status)+'</span>'}]),
      rows,{onRow:abrirObra,empty:'Nenhum projeto. Converta um orçamento em venda para abrir o primeiro.'});
    wireTable(el,'obras',{onRow:abrirObra});
  };
  ['fs','fv','fc'].forEach(i=>document.getElementById(i).onchange=draw);draw();
};
let obraTab='resultado';
function abrirObra(oid){
  const o=byId('obras',oid);if(!o)return;
  const draw=()=>{
    const cm=custoMaterialObra(oid),cmo=custoMaoObra(oid),ct=custoTerceiros(oid),tot=cm+cmo+ct,rec=receitaObra(oid);
    let h='';
    h+='<div class="tabs">'+[['resultado','Resultado'],['etapas','Etapas'],['res','Reservas'],['horas','Horas'],['mat','Materiais'],
      ['adt','Aditivos'],['custo','Orçado × realizado'],['os','Atendimentos'],['ent','Entrega']]
      .map(t=>'<button class="tab'+(obraTab===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div><div id="tb"></div>';
    h+='<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sec sm" id="ed">Editar projeto</button>'+
      '<button class="btn sec sm" id="ah">Apontar horas</button><button class="btn sec sm" id="rs">Reservar material</button>'+
      '<button class="btn sec sm" id="cm">Consumir material</button><button class="btn sec sm" id="ad">Novo aditivo</button>'+
      (o.status!=='Concluída'?'<button class="btn sm" id="fin">Ir para entrega</button>':'')+'</div>';
    modal.className='wide';
    modal.innerHTML='<div class="mhead"><h3>'+esc(o.codigo)+' · '+esc(nm('clientes',o.cliente))+'</h3>'+
      '<button class="x" onclick="closeM()">&times;</button></div><div class="mbody">'+h+'</div>';
    ovl.classList.add('on');
    const tb=document.getElementById('tb');
    if(obraTab==='resultado'){
      tb.innerHTML=htmlResultado(o);
    }else if(obraTab==='etapas'){
      const med=o.cobranca==='medicao';
      tb.innerHTML=(med?'':'<div class="note" style="margin:0 0 8px">Cobrança deste projeto por parcelas com data — concluir etapas não gera recebimento.</div>')+
        tbl([{l:'Etapa',k:'nome',s:1},{l:med?'% medição':'Peso',n:1,f:e=>e.pct+'%'},
        {l:'Status',f:e=>'<span class="bg '+bgFor(e.status)+'">'+esc(e.status)+'</span>'},
        {l:'',n:1,f:e=>e.status!=='Concluída'?'<button class="btn sec sm" data-et="'+esc(e.nome)+'">Concluir</button>':''}],
        (o.etapas||[]).map((e,i)=>Object.assign({id:'e'+i},e)),{empty:'Sem etapas.'});
      tb.querySelectorAll('[data-et]').forEach(b=>b.onclick=()=>concluirEtapa(o,b.dataset.et,draw));
    }else if(obraTab==='horas'){
      const ap=S.apontamentos.filter(a=>a.obra===oid);
      tb.innerHTML=tbl([{l:'Data',f:a=>dBR(a.data)},{l:'Colaborador',f:a=>esc(nm('colaboradores',a.colaborador))},
        {l:'Etapa',k:'etapa'},{l:'Horas',n:1,f:a=>num(a.horas,1)},
        {l:'Custo',n:1,f:a=>{const c=byId('colaboradores',a.colaborador);return money(Number(a.horas||0)*Number((c&&c.custo_hora)||0))}}],
        ap,{empty:'Nenhuma hora apontada.'});
    }else if(obraTab==='mat'){
      const mv=S.estoque.filter(m=>m.obra===oid);
      tb.innerHTML=tbl([{l:'Data',f:m=>dBR(m.data)},{l:'Produto',s:1,f:m=>esc(nm('produtos',m.produto))},
        {l:'Local',f:m=>esc(nm('locais',m.local))},{l:'Qtd',n:1,f:m=>num(m.qtd,2)},
        {l:'Custo',n:1,f:m=>money(Math.abs(Number(m.qtd||0))*Number(m.custo||0))}],mv,{empty:'Nenhum material consumido.'});
    }else if(obraTab==='custo'){
      const om=Number(o.orcado_material||0),omo=Number(o.orcado_mo||0);
      const rows=[{l:'Material',o:om,r:cm},{l:'Mão de obra',o:omo,r:cmo},{l:'Terceiros e despesas',o:0,r:ct}];
      tb.innerHTML=tbl([{l:'Linha',k:'l',s:1},{l:'Orçado',n:1,f:x=>money(x.o)},{l:'Realizado',n:1,f:x=>money(x.r)},
        {l:'Desvio',n:1,f:x=>x.o?'<span class="bg '+(x.r>x.o?'g-red':'g-green')+'">'+pct((x.r-x.o)/x.o*100)+'</span>':'—'}],
        rows.map((x,i)=>Object.assign({id:'c'+i},x)),{foot:'<tfoot><tr><td>Total</td><td class="n">'+money(om+omo)+
        '</td><td class="n">'+money(tot)+'</td><td class="n">'+((om+omo)?pct((tot-om-omo)/(om+omo)*100):'—')+'</td></tr></tfoot>'});
    }else if(obraTab==='res'){
      const rs=S.reservas.filter(r=>r.obra===oid);
      tb.innerHTML=tbl([{l:'Data',f:r=>dBR(r.data)},{l:'Produto',s:1,f:r=>esc(nm('produtos',r.produto))},
        {l:'Reservado',n:1,f:r=>num(r.qtd,2)},
        {l:'No almoxarifado',n:1,f:r=>{const a=saldoAlmox(r.produto);return '<span class="bg '+(a<Number(r.qtd)?'g-red':'g-green')+'">'+num(a,2)+'</span>'}},
        {l:'Status',f:r=>'<span class="bg '+(r.status==='Ativa'?'g-amber':r.status==='Consumida'?'g-green':'g-gray')+'">'+esc(r.status)+'</span>'},
        {l:'',n:1,f:r=>r.status==='Ativa'?'<button class="btn sec sm" data-bx="'+r.id+'">Baixar</button> <button class="btn sec sm" data-cx="'+r.id+'">Liberar</button>':''}],
        rs,{empty:'Nenhuma reserva. Orçamentos aprovados reservam o material automaticamente.'})+
        '<div class="note">Baixar = o material saiu para o projeto (entra no custo). Liberar = a reserva foi cancelada e o item volta a ficar disponível para outras vendas.</div>';
      tb.querySelectorAll('[data-bx]').forEach(b=>b.onclick=()=>baixarReserva(byId('reservas',b.dataset.bx),o,draw));
      tb.querySelectorAll('[data-cx]').forEach(b=>b.onclick=()=>{const r=byId('reservas',b.dataset.cx);
        r.status='Liberada';put('reservas',r);toast('Reserva liberada');draw()});
    }else if(obraTab==='adt'){
      const ad=S.aditivos.filter(a=>a.obra===oid);
      const cust=a=>Number(a.custo_material||0)+Number(a.custo_mo||0);
      const semCobranca=ad.filter(a=>a.status==='Aprovado'&&Number(a.valor||0)===0).reduce((x,a)=>x+cust(a),0);
      tb.innerHTML=tbl([{l:'Nº',k:'numero',s:1},{l:'Descrição',k:'descricao'},{l:'Motivo',k:'motivo'},
        {l:'Venda',n:1,f:a=>money(a.valor)},{l:'Custo',n:1,f:a=>money(cust(a))},
        {l:'Margem',n:1,f:a=>{const v=Number(a.valor||0);if(!v)return '<span class="bg g-red">sem cobrança</span>';
          const m=(v-cust(a))/v*100;return '<span class="bg '+(m<30?'g-red':m<40?'g-amber':'g-green')+'">'+pct(m)+'</span>'}},
        {l:'Prazo',n:1,f:a=>a.prazo?'+'+a.prazo+'d':'—'},
        {l:'Status',f:a=>'<span class="bg '+(a.status==='Aprovado'?'g-green':a.status==='Recusado'?'g-red':'g-amber')+'">'+esc(a.status)+'</span>'},
        {l:'',n:1,f:a=>a.status==='Pendente'?'<button class="btn sec sm" data-ap="'+a.id+'">Aprovar</button> <button class="btn sec sm" data-rc="'+a.id+'">Recusar</button>':''}],
        ad,{empty:'Nenhum aditivo neste projeto.'})+
        (semCobranca?'<div class="note" style="color:var(--red)">'+money(semCobranca)+' em aditivos absorvidos sem cobrança nesta obra.</div>':'')+
        '<div class="note">Aditivo aprovado soma ao valor contratado e ao orçado, estende o prazo e gera a conta a receber. O motivo mostra quanto do escopo extra vem do cliente e quanto vem de falha de levantamento.</div>';
      tb.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>aprovarAditivo(byId('aditivos',b.dataset.ap),o,draw));
      tb.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{const a=byId('aditivos',b.dataset.rc);
        a.status='Recusado';put('aditivos',a);toast('Aditivo recusado');draw()});
    }else if(obraTab==='ent'){
      renderEntrega(o,tb,draw);
    }else{
      const oss=osDaObra(oid);
      tb.innerHTML=tbl([{l:'Data',f:x=>dBR(x.data)},{l:'Tipo',f:x=>'<span class="bg '+(x.tipo==='Garantia'?'g-purple':'g-gray')+'">'+esc(x.tipo)+'</span>'},
        {l:'Descrição',k:'descricao',s:1},{l:'Técnico',f:x=>esc(nm('colaboradores',x.tecnico))},
        {l:'Status',f:x=>'<span class="bg '+bgFor(x.status)+'">'+esc(x.status)+'</span>'}],oss,{empty:'Nenhum atendimento neste projeto.'})+
        '<div class="note">Horas lançadas em OS de garantia aparecem na aba Horas e reduzem a margem real do projeto.</div>';
    }
    modal.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{obraTab=b.dataset.tab;draw()});
    document.getElementById('ed').onclick=()=>editarObra(o,draw);
    document.getElementById('ah').onclick=()=>apontarHoras(o,draw);
    document.getElementById('cm').onclick=()=>consumirMaterial(o,draw);
    document.getElementById('rs').onclick=()=>reservarMaterial(o,draw);
    document.getElementById('ad').onclick=()=>novoAditivo(o,draw);
    const f=document.getElementById('fin');
    if(f)f.onclick=()=>{obraTab='ent';draw()};
  };
  draw();
}
function editarObra(o,after){
  const f=[{k:'codigo',l:'Código',req:1},{k:'titulo',l:'Escopo'},{k:'cliente',l:'Cliente',t:'ref',col:'clientes'},campoUnid,
    Object.assign({},campoCL,{req:1}),Object.assign({},campoCC,{req:1}),
    {k:'vertical',l:'Vertical',t:'select',opts:VERTICAIS},{k:'valor',l:'Valor contratado (R$)',t:'money'},
    {k:'orcado_material',l:'Material orçado (R$)',t:'money'},{k:'orcado_mo',l:'Mão de obra orçada (R$)',t:'money'},
    {k:'inicio',l:'Início',t:'date'},{k:'fim_prev',l:'Fim previsto',t:'date'},
    {k:'status',l:'Status',t:'select',opts:['Em execução','Pausada','Concluída','Cancelada']}];
  openM('Editar projeto',formHtml(f,Object.assign({empresa:empDe('obras',o),centro_lucro:centroDe('lucro','obras',o),centro_custo:centroDe('custo','obras',o)},o)),'Salvar',d=>{Object.assign(o,d);put('obras',o);closeM();after()});
}
function concluirEtapa(o,nome,after){
  const e=(o.etapas||[]).find(x=>x.nome===nome);if(!e)return;
  e.status='Concluída';e.concluida=hoje();put('obras',o);
  if(o.cobranca==='medicao'&&Number(e.pct||0)>0){
    put('financeiro',{tipo:'Receber',descricao:o.codigo+' · medição '+nome,categoria:'Serviço',
      valor:Number(o.base_medicao!=null?o.base_medicao:o.valor||0)*Number(e.pct)/100,vencimento:addDias(hoje(),15),
      cliente:o.cliente,obra:o.id,venda:o.venda||'',empresa:empDe('obras',o),origem:'medicao',status:'Pendente'});
    toast('Etapa concluída e medição de '+e.pct+'% liberada');
  }else toast('Etapa concluída');
  after();
}
function apontarHoras(o,after){
  const f=[{k:'colaborador',l:'Colaborador',t:'ref',col:'colaboradores',req:1},
    {k:'data',l:'Data',t:'date',req:1},{k:'horas',l:'Horas',t:'number',step:'0.5',req:1},
    {k:'etapa',l:'Etapa',t:'select',opts:(o.etapas||[]).map(e=>e.nome)},{k:'obs',l:'Observação'}];
  openM('Apontar horas · '+o.codigo,formHtml(f,{data:hoje()}),'Lançar',d=>{
    d.obra=o.id;put('apontamentos',d);closeM();toast('Horas lançadas');after()});
}
function consumirMaterial(o,after){
  if(!S.produtos.length||!S.locais.length){toast('Cadastre produtos e locais primeiro');return}
  const f=[{k:'produto',l:'Produto ou kit',t:'ref',col:'produtos',req:1,filtro:ativo,rotulo:rotuloProd},
    {k:'local',l:'Sai de qual local',t:'ref',col:'locais',req:1},
    {k:'qtd',l:'Quantidade',t:'number',step:'0.01',req:1},{k:'data',l:'Data',t:'date',req:1}];
  openM('Consumir material · '+o.codigo,formHtml(f,{data:hoje()}),'Baixar',d=>{
    const kit=byId('produtos',d.produto), partes=explodir(d.produto,Math.abs(Number(d.qtd)));
    const faltas=partes.filter(c=>c.qtd>saldoProdLocal(c.produto,d.local));
    if(faltas.length&&!confirm('Saldo insuficiente no local para: '+faltas.map(c=>nm('produtos',c.produto)).join(', ')+'. Registrar mesmo assim?'))return;
    partes.forEach(c=>{const p=byId('produtos',c.produto);
      put('estoque',{produto:c.produto,local:d.local,qtd:-c.qtd,tipo:'Saída',data:d.data,obra:o.id,
        custo:Number((p&&p.custo)||0),doc:'Consumo '+o.codigo+(ehKit(kit)?' · '+kit.nome:'')})});
    closeM();toast(ehKit(kit)?'Kit baixado no projeto: '+partes.length+' componentes':'Material baixado no projeto');after();
  });
}
/* ---------- reservas ---------- */
function reservarMaterial(o,after){
  if(!S.produtos.length){toast('Cadastre produtos primeiro');return}
  const f=[{k:'produto',l:'Produto ou kit',t:'ref',col:'produtos',req:1,filtro:ativo,rotulo:rotuloProd},
    {k:'qtd',l:'Quantidade',t:'number',step:'0.01',req:1}];
  openM('Reservar material · '+o.codigo,formHtml(f,{qtd:1}),'Reservar',d=>{
    const kit=ehKit(byId('produtos',d.produto))?d.produto:'';
    let falta=0;
    explodir(d.produto,Number(d.qtd)).forEach(c=>{
      if(saldoDisponivel(c.produto)<c.qtd)falta++;
      put('reservas',{obra:o.id,produto:c.produto,qtd:c.qtd,status:'Ativa',data:hoje(),kit:kit});
    });
    closeM();obraTab='res';
    toast(falta?'Reservado — '+falta+' item(ns) sem saldo suficiente. Programe a compra.':'Material reservado');
    after();
  });
}
function baixarReserva(r,o,after){
  const alm=[almoxDe(empDe('obras',o))].filter(Boolean);
  const f=[{k:'local',l:'Sai de qual local',t:'ref',col:'locais',req:1},
    {k:'qtd',l:'Quantidade (reservado: '+num(r.qtd,2)+')',t:'number',step:'0.01',req:1},{k:'data',l:'Data',t:'date',req:1}];
  openM('Baixar reserva · '+nm('produtos',r.produto),formHtml(f,{local:alm.length?alm[0].id:'',qtd:r.qtd,data:hoje()}),'Baixar',d=>{
    const p=byId('produtos',r.produto),q=Math.abs(Number(d.qtd));
    put('estoque',{produto:r.produto,local:d.local,qtd:-q,tipo:'Saída',data:d.data,obra:o.id,
      custo:Number((p&&p.custo)||0),doc:'Reserva '+o.codigo});
    const resto=Number(r.qtd)-q;
    if(resto>0.0001){r.qtd=resto}else{r.status='Consumida';r.baixada=d.data}
    put('reservas',r);closeM();toast(resto>0.0001?'Baixa parcial — '+num(resto,2)+' seguem reservados':'Reserva baixada no projeto');after();
  });
}

/* ---------- aditivos ---------- */
function novoAditivo(o,after){
  const f=[{k:'descricao',l:'O que muda no escopo',req:1,full:1},
    {k:'motivo',l:'Motivo',t:'select',req:1,opts:['Solicitação do cliente','Mudança de projeto','Condição encontrada em campo','Falha de levantamento']},
    {k:'prazo',l:'Dias adicionais de prazo',t:'number',step:'1'},
    {k:'valor',l:'Valor cobrado do cliente (R$)',t:'money'},{k:'custo_material',l:'Custo de material (R$)',t:'money'},
    {k:'custo_mo',l:'Custo de mão de obra (R$)',t:'money'}];
  openM('Novo aditivo · '+o.codigo,formHtml(f,{prazo:0})+
    '<div class="note">Valor zero é permitido — registra escopo absorvido pela empresa, que entra no custo sem receita.</div>','Registrar',d=>{
    const n=S.aditivos.filter(a=>a.obra===o.id).length+1;
    d.obra=o.id;d.numero='AD-'+String(n).padStart(2,'0');d.status='Pendente';d.data=hoje();
    put('aditivos',d);closeM();obraTab='adt';toast('Aditivo registrado — aguardando aprovação');after();
  });
}
function aprovarAditivo(a,o,after){
  const v=Number(a.valor||0),c=Number(a.custo_material||0)+Number(a.custo_mo||0);
  const m=v?(v-c)/v*100:-100;
  if(m<30&&!confirm(v?'Margem do aditivo é '+pct(m)+', abaixo de 30%. Aprovar mesmo assim?':'Aditivo sem cobrança: '+money(c)+' de custo absorvido. Aprovar?'))return;
  a.status='Aprovado';a.aprovado_em=hoje();put('aditivos',a);
  o.valor=Number(o.valor||0)+v;
  o.orcado_material=Number(o.orcado_material||0)+Number(a.custo_material||0);
  o.orcado_mo=Number(o.orcado_mo||0)+Number(a.custo_mo||0);
  if(Number(a.prazo)>0&&o.fim_prev)o.fim_prev=addDias(o.fim_prev,Number(a.prazo));
  put('obras',o);
  if(v>0)put('financeiro',{tipo:'Receber',descricao:o.codigo+' · aditivo '+a.numero,categoria:'Serviço',
    valor:v,vencimento:addDias(hoje(),15),cliente:o.cliente,obra:o.id,empresa:empDe('obras',o),origem:'aditivo',status:'Pendente'});
  toast('Aditivo aprovado'+(v?' · '+money(v)+' a receber':''));after();
}

/* ---------- entrega técnica ---------- */
const CHECK_BASE=['Todos os circuitos e cargas testados','Cenas e automações programadas conforme projeto',
  'Interfaces (touch panels e app) configuradas','Acesso remoto testado','Treinamento do usuário realizado',
  'Documentação entregue (diagramas, endereçamento, credenciais)','Equipamentos e quadros etiquetados',
  'Área limpa e sobras devolvidas ao estoque'];
const CHECK_VERT={
  Residencial:['Áudio e vídeo testados em todos os ambientes','Integração com assistentes de voz validada'],
  Predial:['Controle de acesso testado com todas as credenciais','CFTV gravando e com retenção configurada',
    'Integração com portaria validada','Plano de manutenção entregue ao síndico'],
  Corporativo:['Salas de reunião testadas com a equipe','Integração com agenda corporativa validada',
    'Equipe de facilities treinada','Acessos de TI documentados e entregues']};
function checklistPara(v){return CHECK_BASE.concat(CHECK_VERT[v]||[])}
function renderEntrega(o,tb,draw){
  if(!o.entrega)o.entrega={itens:checklistPara(o.vertical).map(t=>({t:t,ok:false})),recebido_por:'',documento:''};
  const e=o.entrega, feitos=e.itens.filter(i=>i.ok).length, total=e.itens.length;
  const etapasAbertas=(o.etapas||[]).filter(x=>x.status!=='Concluída').length;
  const resAtivas=S.reservas.filter(r=>r.obra===o.id&&r.status==='Ativa').length;
  if(e.emitido){
    tb.innerHTML='<div style="padding:4px 0 10px"><span class="bg g-green">Termo emitido em '+dBR(e.emitido)+'</span> '+
      '<span class="bg g-purple">Garantia até '+dBR(o.garantia_ate)+'</span></div>'+
      '<div class="note" style="margin-bottom:10px">Recebido por '+esc(e.recebido_por)+(e.documento?' · '+esc(e.documento):'')+'</div>'+
      e.itens.map(i=>'<div class="ck ok"><input type="checkbox" checked disabled><span>'+esc(i.t)+'</span></div>').join('')+
      (e.obs?'<div class="note">Observações: '+esc(e.obs)+'</div>':'')+
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm" id="dl">Baixar termo para assinatura</button></div>'+
      '<div class="fsec" style="margin-top:16px">Termo assinado pelo cliente '+((e.anexos||[]).length?'<span class="bg g-green">anexado</span>':'<span class="bg g-amber">pendente</span>')+'</div>'+
      '<div id="axTermo"></div>'+
      '<div class="note">Depois da entrega, manutenção é atendida por OS sob demanda. Se o cliente quiser o plano mensal, cadastre em Gestão → Contratos → Manutenção mensal.</div>';
    document.getElementById('dl').onclick=()=>baixarArquivo('termo-entrega-'+o.codigo+'.html',termoHTML(o));
    renderAnexos(document.getElementById('axTermo'),{lista:()=>e.anexos,salvar:a=>{e.anexos=a;put('obras',o)},
      pasta:'termos/'+o.id,depois:draw,vazio:'Anexe aqui o termo digitalizado com a assinatura do cliente.'});
    return;
  }
  let h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:10px;flex-wrap:wrap">'+
    '<b style="font-size:13px">Checklist de comissionamento · '+esc(o.vertical||'')+'</b>'+
    '<span class="bg '+(feitos===total?'g-green':'g-amber')+'">'+feitos+' de '+total+'</span></div>'+
    '<div class="bar" style="margin-bottom:10px"><i style="width:'+(total?feitos/total*100:0)+'%"></i></div>'+
    e.itens.map((i,ix)=>'<label class="ck'+(i.ok?' ok':'')+'"><input type="checkbox" data-ck="'+ix+'"'+(i.ok?' checked':'')+'><span>'+esc(i.t)+'</span></label>').join('')+
    '<div style="display:flex;gap:8px;margin:8px 0 14px"><input type="text" id="nck" placeholder="Adicionar item ao checklist deste projeto"><button class="btn sec sm" id="ack">Adicionar</button></div>'+
    '<div class="frow"><label class="f"><span>Recebido por (cliente) *</span><input type="text" id="rp" value="'+esc(e.recebido_por)+'"></label>'+
    '<label class="f"><span>Documento do recebedor</span><input type="text" id="dc" value="'+esc(e.documento)+'"></label></div>'+
    '<label class="f"><span>Observações e pendências aceitas</span><textarea id="ob">'+esc(e.obs||'')+'</textarea></label>';
  const bloq=[];
  if(feitos<total)bloq.push((total-feitos)+' item(ns) do checklist');
  if(etapasAbertas)bloq.push(etapasAbertas+' etapa(s) não concluída(s)');
  if(!e.recebido_por)bloq.push('nome de quem recebe');
  h+=(bloq.length?'<div class="note" style="color:var(--amber)">Falta: '+bloq.join(' · ')+'</div>':'')+
    (resAtivas?'<div class="note">'+resAtivas+' reserva(s) ainda ativa(s) serão liberadas ao emitir o termo.</div>':'')+
    '<div style="margin-top:10px"><button class="btn" id="em"'+(bloq.length?' disabled':'')+'>Emitir termo e concluir projeto</button></div>';
  tb.innerHTML=h;
  const persist=()=>{e.recebido_por=document.getElementById('rp').value;e.documento=document.getElementById('dc').value;
    e.obs=document.getElementById('ob').value;put('obras',o)};
  tb.querySelectorAll('[data-ck]').forEach(c=>c.onchange=()=>{persist();e.itens[Number(c.dataset.ck)].ok=c.checked;put('obras',o);draw()});
  ['rp','dc','ob'].forEach(id=>document.getElementById(id).onchange=()=>{persist();draw()});
  document.getElementById('ack').onclick=()=>{const t=document.getElementById('nck').value.trim();
    if(!t)return;persist();e.itens.push({t:t,ok:false});put('obras',o);draw()};
  document.getElementById('em').onclick=()=>{
    persist();
    e.emitido=hoje();o.status='Concluída';o.fim=hoje();
    const cv=S.contratos.find(c=>ehCtrVenda(c)&&(c.obra===o.id||(o.venda&&c.venda===o.venda))&&c.status!=='Cancelado');
    const gm=Number((cv&&cv.garantia_meses)||12);
    const gd=new Date(hoje()+'T12:00:00');gd.setMonth(gd.getMonth()+gm);o.garantia_ate=gd.toISOString().slice(0,10);
    if(cv){cv.status='Concluído';cv.garantia_ate=o.garantia_ate;cv.entregue_em=hoje();put('contratos',cv)}
    S.reservas.filter(r=>r.obra===o.id&&r.status==='Ativa').forEach(r=>{r.status='Liberada';put('reservas',r)});
    put('obras',o);toast('Termo emitido · projeto concluído · garantia até '+dBR(o.garantia_ate));draw();
  };
}
function termoHTML(o){
  const c=byId('clientes',o.cliente)||{}, e=o.entrega||{itens:[]};
  const ad=S.aditivos.filter(a=>a.obra===o.id&&a.status==='Aprovado');
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo de entrega '+esc(o.codigo)+'</title>'+
  '<style>body{font-family:Helvetica,Arial,sans-serif;max-width:760px;margin:40px auto;color:#1a1a1a;font-size:13px;line-height:1.55;padding:0 20px}'+
  'h1{font-size:19px;margin:0 0 4px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#555;margin:26px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}'+
  'table{width:100%;border-collapse:collapse}td{padding:5px 0;vertical-align:top}td.k{color:#666;width:190px}'+
  '.it{padding:4px 0}.it b{display:inline-block;width:18px}.sig{display:flex;gap:40px;margin-top:60px}'+
  '.sig div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:12px}'+
  '@media print{body{margin:0}}</style></head><body>'+
  '<h1>Termo de Entrega Técnica</h1><div style="color:#666">'+esc(o.codigo)+' · emitido em '+dBR(e.emitido)+'</div>'+
  '<h2>Identificação</h2><table>'+
  '<tr><td class="k">Cliente</td><td>'+esc(c.nome||'—')+(c.documento?' · '+esc(c.documento):'')+'</td></tr>'+
  '<tr><td class="k">Endereço</td><td>'+esc(c.endereco||c.cidade||'—')+'</td></tr>'+
  '<tr><td class="k">Escopo</td><td>'+esc(o.titulo||'—')+'</td></tr>'+
  '<tr><td class="k">Vertical</td><td>'+esc(o.vertical||'—')+'</td></tr>'+
  '<tr><td class="k">Execução</td><td>'+dBR(o.inicio)+' a '+dBR(o.fim)+'</td></tr>'+
  '<tr><td class="k">Garantia dos serviços</td><td>até '+dBR(o.garantia_ate)+'</td></tr></table>'+
  (ad.length?'<h2>Aditivos incorporados</h2>'+ad.map(a=>'<div class="it">'+esc(a.numero)+' — '+esc(a.descricao)+'</div>').join(''):'')+
  '<h2>Verificações de comissionamento</h2>'+e.itens.map(i=>'<div class="it"><b>'+(i.ok?'✓':'—')+'</b>'+esc(i.t)+'</div>').join('')+
  (e.obs?'<h2>Observações</h2><div>'+esc(e.obs)+'</div>':'')+
  '<h2>Declaração</h2><div>O cliente declara ter recebido o sistema descrito acima em pleno funcionamento, ter sido treinado em sua operação '+
  'e ter recebido a documentação técnica correspondente. A garantia cobre defeitos de instalação e programação no prazo indicado, '+
  'não abrangendo mau uso, intervenção de terceiros ou danos elétricos externos.</div>'+
  '<div class="sig"><div>'+esc(e.recebido_por||'Cliente')+(e.documento?'<br>'+esc(e.documento):'')+'</div><div>Responsável técnico</div></div>'+
  '</body></html>';
}
async function baixarArquivo(nome,conteudo){
  if(typeof claude==='undefined'){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([conteudo]));
    a.download=nome;document.body.appendChild(a);a.click();a.remove();return;
  }
  if(!DL){try{DL=await claude.use('downloads')}catch(e){DL=null}}
  if(!DL){openM('Download indisponível','<div class="note">O download não está disponível nesta visualização. Abra o sistema pelo link publicado para baixar arquivos.</div>');return}
  try{await DL.save({filename:nome,data:conteudo})}
  catch(e){if(e&&e.code!=='declined')toast('Não foi possível baixar: '+(e.code||'erro'))}
}

/* ---------- resultado do projeto: pré-venda, execução até a entrega, pós-venda ---------- */
const TIPOS_POS=['Garantia','Corretiva','Manutenção preventiva'];
function marcosProjeto(o){
  const v=o.venda?byId('vendas',o.venda):null;
  return{venda:(v&&v.data)||o.inicio||'',entrega:(o.entrega&&o.entrega.emitido)||(o.status==='Concluída'?(o.fim||''):'')};
}
function resultadoProjeto(o){
  const mk=marcosProjeto(o), z=()=>({rec:0,mat:0,mo:0,ter:0,h:0}), R={pre:z(),exe:z(),pos:z()};
  const fase=(d,forcaPos)=>forcaPos?'pos':(mk.entrega&&d&&d>mk.entrega)?'pos':(mk.venda&&d&&d<mk.venda)?'pre':'exe';
  R.exe.rec=Number(o.valor||0);
  S.estoque.filter(m=>m.obra===o.id&&Number(m.qtd)<0).forEach(m=>{R[fase(m.data)].mat+=Math.abs(Number(m.qtd))*Number(m.custo||0)});
  S.apontamentos.filter(a=>a.obra===o.id).forEach(a=>{
    const c=byId('colaboradores',a.colaborador), os=a.os?byId('os',a.os):null;
    const f=fase(a.data,os&&TIPOS_POS.includes(os.tipo));
    R[f].mo+=Number(a.horas||0)*Number((c&&c.custo_hora)||0);R[f].h+=Number(a.horas||0);
  });
  S.financeiro.filter(l=>l.obra===o.id&&l.tipo==='Pagar').forEach(l=>{R[fase(l.vencimento)].ter+=Number(l.valor||0)});
  const ctrIds=S.contratos.filter(c=>c.obra===o.id&&ehCtrManut(c)).map(c=>c.id);
  S.financeiro.filter(l=>l.tipo==='Receber'&&l.contrato&&ctrIds.includes(l.contrato)).forEach(l=>{R.pos.rec+=Number(l.valor||0)});
  S.financeiro.filter(l=>l.tipo==='Receber'&&l.obra===o.id&&!l.venda&&!l.contrato&&(l.origem==='os'||(!l.origem&&
    !/aditivo|medição|parcela|entrada/i.test(l.descricao||'')))).forEach(l=>{const os=l.os?byId('os',l.os):null;
      R[(os&&TIPOS_POS.includes(os.tipo))||fase(l.vencimento)==='pos'?'pos':'exe'].rec+=Number(l.valor||0)});
  S.os.filter(x=>x.cliente===o.cliente&&!x.obra&&x.tipo==='Visita técnica'&&x.status==='Concluída'&&mk.venda&&x.data<=mk.venda).forEach(x=>{
    const c=byId('colaboradores',x.tecnico),h=Number(x.horas_reais||x.duracao||0);R.pre.mo+=h*Number((c&&c.custo_hora)||0);R.pre.h+=h});
  const fech=r=>Object.assign(r,{custo:r.mat+r.mo+r.ter,res:r.rec-(r.mat+r.mo+r.ter)});
  ['pre','exe','pos'].forEach(k=>fech(R[k]));
  const soma=ks=>fech(ks.reduce((t,k)=>({rec:t.rec+R[k].rec,mat:t.mat+R[k].mat,mo:t.mo+R[k].mo,ter:t.ter+R[k].ter,h:t.h+R[k].h}),z()));
  R.entrega=soma(['pre','exe']);R.ciclo=soma(['pre','exe','pos']);R.marcos=mk;
  R.mEntrega=R.entrega.rec?R.entrega.res/R.entrega.rec*100:null;R.mCiclo=R.ciclo.rec?R.ciclo.res/R.ciclo.rec*100:null;
  return R;
}
const badgeMg=m=>m==null?'—':'<span class="bg '+(m<20?'g-red':m<32?'g-amber':'g-green')+'">'+pct(m)+'</span>';
function htmlResultado(o){
  const R=resultadoProjeto(o), mk=R.marcos;
  const lin=(l,k,neg,b)=>'<tr><td'+(b?' class="s"':'')+'>'+l+'</td>'+['pre','exe','pos','entrega','ciclo'].map(f=>{
    const v=R[f][k];return '<td class="n'+(b?' s':'')+(f==='entrega'||f==='ciclo'?'" style="background:var(--panel-2)':'')+'">'+
      (k==='h'?num(v,1)+'h':(neg&&v?'('+money(v)+')':money(v)))+'</td>'}).join('')+'</tr>';
  const recebido=S.financeiro.filter(l=>l.tipo==='Receber'&&l.status==='Recebido'&&(l.obra===o.id||(o.venda&&l.venda===o.venda))).reduce((a,l)=>a+Number(l.valor||0),0);
  return '<div class="kpis" style="margin-bottom:12px">'+
    kpi('Resultado até a entrega',money(R.entrega.res),R.mEntrega==null?'':'margem '+pct(R.mEntrega))+
    kpi('Resultado do ciclo completo',money(R.ciclo.res),R.mCiclo==null?'':'margem '+pct(R.mCiclo))+
    kpi('Pós-venda',money(R.pos.res),R.pos.custo?'custo '+money(R.pos.custo)+(R.pos.rec?' · receita '+money(R.pos.rec):''):'sem movimento')+
    kpi('Recebido',money(recebido),'de '+money(R.ciclo.rec))+'</div>'+
    '<div class="note" style="margin:-4px 0 10px">'+esc(nomeCentro('lucro',centroDe('lucro','obras',o)))+' · '+esc(nomeCentro('custo',centroDe('custo','obras',o)))+
      (S.empresas.length?' · '+esc(nomeUnid(empDe('obras',o))):'')+' · venda em '+dBR(mk.venda)+' · '+(mk.entrega?'entregue em '+dBR(mk.entrega):'em execução')+'</div>'+
    '<div class="scr"><table><thead><tr><th></th><th class="n">Pré-venda</th><th class="n">Execução</th><th class="n">Pós-venda</th>'+
    '<th class="n" style="background:var(--panel-2)">Até a entrega</th><th class="n" style="background:var(--panel-2)">Ciclo completo</th></tr></thead><tbody>'+
    lin('Receita','rec',0,1)+lin('(−) Material','mat',1)+lin('(−) Mão de obra','mo',1)+lin('(−) Terceiros e despesas','ter',1)+
    lin('= Resultado','res',0,1)+
    '<tr><td>Margem</td>'+['pre','exe','pos','entrega','ciclo'].map(f=>'<td class="n"'+(f==='entrega'||f==='ciclo'?' style="background:var(--panel-2)"':'')+'>'+
      (R[f].rec?pct(R[f].res/R[f].rec*100):'—')+'</td>').join('')+'</tr>'+lin('Horas','h')+
    '</tbody></table></div>'+
    '<div class="note">Pré-venda: visitas técnicas ao cliente antes da venda e lançamentos anteriores a ela. Execução: tudo entre a venda e o termo de entrega. '+
    'Pós-venda: o que vem depois da entrega, mais qualquer OS de garantia, corretiva ou manutenção — e, como receita, as OS sob demanda cobradas e as mensalidades de manutenção, se o cliente tiver plano.'+
    (mk.entrega?'':' Enquanto o termo não é emitido, tudo que não é pré-venda conta como execução.')+'</div>';
}

/* ---------- ordens de serviço ---------- */
R.os=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Nova OS</button>'+
    '<select id="ft"><option value="">Todos os tipos</option>'+
    ['Instalação','Manutenção preventiva','Corretiva','Garantia','Visita técnica','Treinamento'].map(x=>'<option>'+x+'</option>').join('')+
    '</select><select id="fs"><option value="">Todos os status</option>'+
    ['Agendada','Em execução','Concluída','Cancelada'].map(x=>'<option>'+x+'</option>').join('')+'</select></div>'+
    '<div class="card"><div class="cbody" id="lst"></div></div>';
  document.getElementById('nv').onclick=()=>editRec('os',null);
  const draw=()=>{
    const ft=document.getElementById('ft').value,fs=document.getElementById('fs').value;
    const rows=U('os').filter(o=>(!ft||o.tipo===ft)&&(!fs||o.status===fs))
      .sort((a,b)=>String(b.data).localeCompare(String(a.data)));
    const el=document.getElementById('lst');
    el.innerHTML=tbl([{l:'Data',f:r=>dBR(r.data)+(r.hora?' '+esc(r.hora):'')},
      {l:'Cliente',s:1,f:r=>esc(nm('clientes',r.cliente))}].concat(colUnid('os'),[
      {l:'Projeto',f:r=>r.obra?esc(nm('obras',r.obra,'codigo')):'—'},
      {l:'Tipo',f:r=>'<span class="bg '+(r.tipo==='Garantia'?'g-purple':r.tipo==='Corretiva'?'g-amber':'g-gray')+'">'+esc(r.tipo)+'</span>'},
      {l:'Descrição',k:'descricao'},{l:'Técnico',f:r=>esc(nm('colaboradores',r.tecnico))},
      {l:'Cobrança',f:r=>{const c=cobrOS(r);return '<span class="bg '+(c==='Sob demanda'?'g-green':c==='Garantia'?'g-purple':c==='Contrato de manutenção'?'g-accent':'g-gray')+'">'+esc(c)+'</span>'}},
      {l:'Valor',n:1,f:r=>cobrOS(r)==='Sob demanda'&&Number(r.valor)?money(r.valor):'—'},
      {l:'Status',f:r=>{const atr=r.status==='Agendada'&&r.data<hoje();
        return '<span class="bg '+(atr?'g-red':bgFor(r.status))+'">'+(atr?'Atrasada':esc(r.status))+'</span>'}},
      {l:'',n:1,f:r=>r.status!=='Concluída'?'<button class="btn sec sm" data-cl="'+r.id+'">Concluir</button>':''}]),
      rows,{acts:1,empty:'Nenhuma ordem de serviço.'});
    wireTable(el,'os');
    el.querySelectorAll('[data-cl]').forEach(b=>b.onclick=e=>{e.stopPropagation();concluirOS(b.dataset.cl,draw)});
  };
  document.getElementById('ft').onchange=draw;document.getElementById('fs').onchange=draw;draw();
};
function concluirOS(id,after){
  const o=byId('os',id);if(!o)return;
  const cob=cobrOS(o), dem=cob==='Sob demanda';
  const f=[{k:'horas',l:'Horas gastas',t:'number',step:'0.5',req:1}].concat(dem?[{k:'valor',l:'Valor a cobrar do cliente (R$)',t:'money'},
    {k:'venc',l:'Vencimento',t:'date'}]:[]).concat([{k:'laudo',l:'Laudo / o que foi feito',t:'textarea'}]);
  openM('Concluir OS · '+cob,formHtml(f,{horas:o.duracao||1,laudo:o.laudo,valor:o.valor||'',venc:addDias(hoje(),10)})+
    (dem?'':'<div class="note">'+(cob==='Garantia'?'Atendimento em garantia: sem cobrança ao cliente, o custo entra no pós-venda do projeto.':
      cob==='Contrato de manutenção'?'Coberto pelo contrato mensal: sem cobrança avulsa.':'Sem cobrança avulsa.')+'</div>'),'Concluir',d=>{
    o.status='Concluída';o.laudo=d.laudo;o.horas_reais=d.horas;o.cobranca=cob;if(dem)o.valor=Number(d.valor||0);put('os',o);
    const semProj=!o.obra, ccS=centroPorNome('centros_custo',/suporte|pós/i), clM=centroPorNome('centros_lucro',/manuten/i);
    if(o.tecnico&&Number(d.horas)>0)put('apontamentos',{obra:o.obra||'',colaborador:o.tecnico,data:o.data||hoje(),horas:Number(d.horas),
      etapa:'OS · '+o.tipo,os:o.id,empresa:empDe('os',o),centro_custo:semProj?ccS:'',centro_lucro:semProj?clM:''});
    let msg='OS concluída';
    if(dem&&Number(d.valor)>0){put('financeiro',{tipo:'Receber',descricao:'OS · '+o.descricao,categoria:'Serviço',valor:Number(d.valor),
      vencimento:d.venc||addDias(hoje(),10),cliente:o.cliente,obra:o.obra||'',empresa:empDe('os',o),centro_lucro:semProj?clM:'',
      origem:'os',os:o.id,status:'Pendente'});msg+=' · '+money(d.valor)+' a receber'}
    if(o.obra&&Number(d.horas)>0)msg+=' · '+d.horas+'h no custo do projeto';
    toast(msg);closeM();after?after():render();
  });
}

/* ---------- agenda ---------- */
let calRef=new Date().toISOString().slice(0,7);
R.agenda=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Compromisso</button>'+
    '<button class="btn sec sm" id="pv">◀</button><span class="pill" id="lbl"></span><button class="btn sec sm" id="nx">▶</button></div>'+
    '<div class="card"><div class="cbody scr"><div class="cal" id="cal"></div></div></div>'+
    '<div class="card"><div class="chead"><h2>Capacidade da equipe</h2><span class="hint">horas agendadas no mês vs. disponível</span></div>'+
    '<div class="cbody" id="cap"></div></div>';
  document.getElementById('nv').onclick=()=>editRec('agenda',null);
  document.getElementById('pv').onclick=()=>{calRef=shiftMes(calRef,-1);draw()};
  document.getElementById('nx').onclick=()=>{calRef=shiftMes(calRef,1);draw()};
  const draw=()=>{
    document.getElementById('lbl').textContent=mesLabel(calRef);
    const [y,m]=calRef.split('-').map(Number);
    const first=new Date(y,m-1,1), start=first.getDay(), dias=new Date(y,m,0).getDate();
    const evs={};
    S.agenda.filter(a=>mesDe(a.data)===calRef).forEach(a=>{(evs[a.data]=evs[a.data]||[]).push(
      {t:(a.hora?a.hora+' ':'')+a.titulo,c:'g-accent',id:a.id,col:'agenda'})});
    U('os').filter(o=>mesDe(o.data)===calRef).forEach(o=>{(evs[o.data]=evs[o.data]||[]).push(
      {t:'OS · '+(o.descricao||o.tipo),c:o.tipo==='Garantia'?'g-purple':'g-brand',id:o.id,col:'os'})});
    let h=['dom','seg','ter','qua','qui','sex','sáb'].map(d=>'<div class="dh">'+d+'</div>').join('');
    for(let i=0;i<start;i++)h+='<div class="cd off"></div>';
    for(let d=1;d<=dias;d++){
      const ds=calRef+'-'+String(d).padStart(2,'0');
      h+='<div class="cd'+(ds===hoje()?' today':'')+'"><div class="dn">'+d+'</div>'+
        (evs[ds]||[]).map(e=>'<div class="ev bg '+e.c+'" data-col="'+e.col+'" data-id="'+e.id+'">'+esc(e.t)+'</div>').join('')+'</div>';
    }
    document.getElementById('cal').innerHTML=h;
    document.getElementById('cal').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>editRec(b.dataset.col,b.dataset.id));
    const cap=S.colaboradores.map(c=>{
      const hs=U('os').filter(o=>o.tecnico===c.id&&mesDe(o.data)===calRef).reduce((a,o)=>a+Number(o.duracao||0),0);
      const disp=Number(c.capacidade||40)*4.3;
      return{id:c.id,nome:c.nome,funcao:c.funcao,hs:hs,disp:disp,u:disp?hs/disp*100:0};
    });
    document.getElementById('cap').innerHTML=tbl([{l:'Colaborador',k:'nome',s:1},{l:'Função',k:'funcao'},
      {l:'Agendado',n:1,f:c=>num(c.hs,1)+'h'},{l:'Disponível',n:1,f:c=>num(c.disp,0)+'h'},
      {l:'Ocupação',f:c=>'<div class="bar'+(c.u>95?' b':c.u>80?' w':'')+'"><i style="width:'+Math.min(100,c.u)+'%"></i></div>'+
        '<span style="font-size:11px">'+pct(c.u)+'</span>'}],cap,{empty:'Cadastre colaboradores.'});
  };
  draw();
};
function shiftMes(m,n){const[y,mm]=m.split('-').map(Number);const d=new Date(y,mm-1+n,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

/* ---------- contratos ---------- */
let ctrTab='venda';
const bgCtr=st=>({'Aguardando assinatura':'g-amber','Assinado':'g-brand','Concluído':'g-green','Cancelado':'g-red','Ativo':'g-green','Encerrado':'g-gray','Suspenso':'g-amber'}[st]||'g-gray');
function telaContratosVenda(v){
  const CV=U('contratos').filter(ehCtrVenda);
  const ag=CV.filter(c=>c.status==='Aguardando assinatura'),ass=CV.filter(c=>c.status==='Assinado');
  v.insertAdjacentHTML('beforeend','<div class="kpis">'+kpi('Contratos de venda',CV.length)+
    kpi('Aguardando assinatura',ag.length,ag.length?money(ag.reduce((a,c)=>a+Number(c.valor||0),0)):'')+
    kpi('Assinados em execução',ass.length,money(ass.reduce((a,c)=>a+Number(c.valor||0),0)))+
    kpi('Concluídos',CV.filter(c=>c.status==='Concluído').length)+'</div>'+
    '<div class="note" style="margin:-4px 0 12px">Os contratos de venda nascem sozinhos quando uma venda é registrada. Abra um contrato para baixar o documento, registrar a assinatura e anexar a via assinada.</div>'+
    '<div class="card"><div class="cbody" id="lst"></div></div>');
  const el=document.getElementById('lst');
  el.innerHTML=tbl([{l:'Nº',k:'numero',s:1},{l:'Cliente',f:r=>esc(nm('clientes',r.cliente))}].concat(colUnid('contratos'),[
    {l:'Venda',f:r=>esc(nm('vendas',r.venda,'numero'))+(r.obra?' · '+esc(nm('obras',r.obra,'codigo')):'')},
    {l:'Objeto',f:r=>'<span style="font-size:12px">'+esc(r.objeto||'')+'</span>'},{l:'Valor',n:1,f:r=>money(r.valor)},
    {l:'Assinatura',f:r=>r.assinado_em?dBR(r.assinado_em)+((r.anexos||[]).length?' <span class="bg g-green">via anexada</span>':''):'—'},
    {l:'Garantia até',f:r=>dBR(r.garantia_ate)},
    {l:'Status',f:r=>'<span class="bg '+bgCtr(r.status)+'">'+esc(r.status)+'</span>'}]),
    CV.slice().sort((a,b)=>String(b.data_venda).localeCompare(String(a.data_venda))),{onRow:abrirContratoVenda,empty:'Nenhum contrato de venda ainda. Eles surgem ao registrar vendas.'});
  wireTable(el,'contratos',{onRow:abrirContratoVenda});
}
function abrirContratoVenda(id){
  const c=byId('contratos',id);if(!c)return;
  const draw=()=>{
    const ls=S.financeiro.filter(l=>l.venda===c.venda&&l.tipo==='Receber').sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
    let h='<div class="kpis" style="margin-bottom:10px">'+kpi('Valor',money(c.valor),c.desconto?'desconto '+money(c.desconto):'')+
      kpi('Status','<span class="bg '+bgCtr(c.status)+'" style="font-size:12px">'+esc(c.status)+'</span>')+
      kpi('Assinado em',c.assinado_em?dBR(c.assinado_em):'—',c.assinado_por||'')+
      kpi('Garantia',c.garantia_ate?'até '+dBR(c.garantia_ate):(c.garantia_meses||12)+' meses após a entrega')+'</div>'+
      '<div class="note" style="margin-bottom:10px">'+esc(nm('clientes',c.cliente))+(S.empresas.length?' · '+esc(nomeUnid(empDe('contratos',c))):'')+
      ' · venda '+esc(nm('vendas',c.venda,'numero'))+(c.obra?' · projeto '+esc(nm('obras',c.obra,'codigo')):'')+' · '+esc(c.forma||'')+
      (c.prazo_dias?' · execução em '+c.prazo_dias+' dias':'')+'</div>'+
      '<div class="fsec">Objeto</div><div style="font-size:13px;margin-bottom:6px">'+esc(c.objeto||'—')+'</div>'+
      (c.clausulas?'<div class="note">Cláusulas adicionais: '+esc(c.clausulas)+'</div>':'')+
      '<div class="fsec">Pagamento</div>'+tbl([{l:'Lançamento',k:'descricao',s:1},{l:'Vencimento',f:l=>dBR(l.vencimento)},
        {l:'Valor',n:1,f:l=>money(l.valor)},{l:'Status',f:l=>'<span class="bg '+bgFor(l.status)+'">'+esc(l.status)+'</span>'}],ls,
        {empty:c.cobranca==='Medição'?'Pagamento por medição das etapas do projeto.':'Sem lançamentos.'})+
      '<div class="fsec">Via assinada</div><div id="axCt"></div>'+
      '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+
      '<button class="btn sm" id="cDl">Baixar contrato para assinatura</button>'+
      (c.status==='Aguardando assinatura'?'<button class="btn sec sm" id="cAs">Registrar assinatura</button>':'')+
      (c.status!=='Cancelado'?'<button class="btn sec sm" id="cEd">Editar dados do contrato</button>':'')+
      (c.obra?'<button class="btn sec sm" id="cOb">Abrir projeto</button>':'')+'</div>'+
      '<div class="note">O documento gerado é um modelo base com as condições desta venda. Revise o texto com seu advogado antes de adotá-lo como padrão.</div>';
    openM('Contrato '+c.numero,h,null,null,true);
    renderAnexos(document.getElementById('axCt'),{lista:()=>c.anexos,salvar:a=>{c.anexos=a;put('contratos',c)},pasta:'contratos/'+c.id,
      depois:draw,vazio:'Anexe aqui o contrato digitalizado com as assinaturas.'});
    document.getElementById('cDl').onclick=()=>baixarArquivo('contrato-'+c.numero+'.html',contratoHTML(c));
    const as=document.getElementById('cAs');
    if(as)as.onclick=()=>{const f=[{k:'assinado_em',l:'Data da assinatura',t:'date',req:1},{k:'assinado_por',l:'Assinado por (cliente)'}];
      openM('Registrar assinatura · '+c.numero,formHtml(f,{assinado_em:hoje(),assinado_por:(byId('clientes',c.cliente)||{}).contato||''}),'Registrar',d=>{
        c.assinado_em=d.assinado_em;c.assinado_por=d.assinado_por;c.status='Assinado';put('contratos',c);toast('Assinatura registrada');draw()})};
    const ed=document.getElementById('cEd');if(ed)ed.onclick=()=>editRec('contratos',c.id,draw);
    const ob=document.getElementById('cOb');if(ob)ob.onclick=()=>abrirObra(c.obra);
  };
  draw();
}
function contratoHTML(c){
  const cl=byId('clientes',c.cliente)||{}, em=byId('empresas',empDe('contratos',c))||{}, v=byId('vendas',c.venda)||{};
  const ls=S.financeiro.filter(l=>l.venda===c.venda&&l.tipo==='Receber').sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
  const endEmp=[em.logradouro,em.numero,em.complemento,em.bairro,em.cidade&&em.uf?em.cidade+'/'+em.uf:em.cidade].filter(Boolean).join(', ');
  const foro=c.foro||(em.cidade?em.cidade+(em.uf?'/'+em.uf:''):'da sede da CONTRATADA');
  const cl_=(n,t,b)=>'<h2>Cláusula '+n+' — '+t+'</h2>'+b;
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Contrato '+esc(c.numero)+'</title>'+
  '<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;color:#1a1a1a;font-size:13.5px;line-height:1.6;padding:0 20px}'+
  'h1{font-size:18px;text-align:center;margin:0 0 4px}h2{font-size:13.5px;margin:22px 0 6px}.c{text-align:center;color:#555;margin-bottom:24px}'+
  'table{width:100%;border-collapse:collapse;margin:6px 0}td,th{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:12.5px}'+
  '.sig{display:flex;gap:40px;margin-top:60px}.sig div{flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:12px}'+
  '@media print{body{margin:0}}</style></head><body>'+
  '<h1>Contrato de Prestação de Serviços e Fornecimento de Equipamentos</h1><div class="c">Nº '+esc(c.numero)+' · venda '+esc(v.numero||'')+'</div>'+
  '<p><b>CONTRATADA:</b> '+esc(em.razao_social||'________')+', CNPJ '+esc(fmtCNPJ(em.cnpj||''))+(endEmp?', com sede em '+esc(endEmp):'')+'.</p>'+
  '<p><b>CONTRATANTE:</b> '+esc(cl.nome||'________')+', '+(cl.pessoa==='Física'?'CPF':'CPF/CNPJ')+' '+esc(cl.documento||'________')+
    (cl.endereco?', residente/sediado em '+esc(cl.endereco):'')+'.</p>'+
  cl_('1ª','Objeto','<p>'+esc(c.objeto||'')+', compreendendo:</p><table><tr><th>Item</th><th>Qtd</th></tr>'+
    (v.itens||[]).map(i=>'<tr><td>'+esc(i.desc)+'</td><td>'+num(i.qtd,2)+'</td></tr>').join('')+'</table>')+
  cl_('2ª','Preço e condições de pagamento','<p>Pelo objeto deste contrato a CONTRATANTE pagará o valor total de <b>'+money(c.valor)+'</b>'+
    (c.desconto?', já considerado desconto de '+money(c.desconto):'')+', por meio de '+esc(c.forma||'')+', '+
    (c.cobranca==='Medição'?'conforme medição das etapas executadas.':'conforme o cronograma abaixo:')+'</p>'+
    (ls.length?'<table><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr>'+ls.map(l=>'<tr><td>'+esc(String(l.descricao).split(' · ').pop())+
      '</td><td>'+dBR(l.vencimento)+'</td><td>'+money(l.valor)+'</td></tr>').join('')+'</table>':''))+
  cl_('3ª','Prazo','<p>'+(c.prazo_dias?'Os serviços serão executados em até '+c.prazo_dias+' dias a contar da assinatura, prorrogáveis por aditivo ou por fatos alheios à CONTRATADA, como atrasos de obra civil ou de liberação do local.':'O fornecimento ocorrerá conforme disponibilidade acordada entre as partes.')+'</p>')+
  cl_('4ª','Obrigações das partes','<p>A CONTRATADA executará o objeto com técnica e materiais adequados, fornecerá a documentação técnica e treinará os usuários. '+
    'A CONTRATANTE garantirá acesso ao local, infraestrutura civil e elétrica compatível e os pagamentos nas datas acordadas. '+
    'Alterações de escopo serão formalizadas por aditivo, com revisão de preço e prazo.</p>')+
  cl_('5ª','Entrega e garantia','<p>A conclusão será formalizada por Termo de Entrega Técnica assinado pela CONTRATANTE. Os serviços têm garantia de '+
    (c.garantia_meses||12)+' meses a partir da entrega; os equipamentos seguem a garantia de seus fabricantes. A garantia não cobre mau uso, '+
    'intervenção de terceiros ou danos elétricos externos.</p>')+
  cl_('6ª','Assistência após a entrega','<p>Após a entrega, atendimentos fora da garantia serão prestados sob demanda, mediante ordem de serviço e orçamento prévio, '+
    'salvo se as partes firmarem contrato de manutenção mensal específico.</p>')+
  cl_('7ª','Rescisão','<p>O descumprimento de qualquer cláusula permite a rescisão mediante notificação, respondendo a parte infratora pelos prejuízos comprovados. '+
    'Em caso de rescisão, serão devidos os serviços executados e os materiais já fornecidos ou encomendados.</p>')+
  (c.clausulas?cl_('8ª','Disposições adicionais','<p>'+esc(c.clausulas)+'</p>'):'')+
  cl_(c.clausulas?'9ª':'8ª','Foro','<p>Fica eleito o foro de '+esc(foro)+' para dirimir questões oriundas deste contrato.</p>')+
  '<p style="margin-top:28px">'+esc(em.cidade||'________')+', ____ de ______________ de ______.</p>'+
  '<div class="sig"><div>'+esc(em.razao_social||'CONTRATADA')+'</div><div>'+esc(cl.nome||'CONTRATANTE')+'</div></div>'+
  '<div class="sig"><div>Testemunha 1 · CPF</div><div>Testemunha 2 · CPF</div></div></body></html>';
}
R.contratos=v=>{
  const nV=U('contratos').filter(ehCtrVenda).length,nM=U('contratos').filter(ehCtrManut).length,nF=U('contratos').filter(ehCtrForn).length;
  const abas='<div class="tabs">'+[['venda','Contratos de venda ('+nV+')'],['cliente','Manutenção mensal ('+nM+')'],['fornecedor','Fornecedores · despesa ('+nF+')']]
      .map(t=>'<button class="tab'+(ctrTab===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
  if(ctrTab==='venda'){v.innerHTML=abas;v.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ctrTab=b.dataset.tab;render()});telaContratosVenda(v);return}
  const forn=ctrTab==='fornecedor', mes=mesDe(hoje()), mesN=String(Number(mes.slice(5)));
  const CT=U('contratos').filter(c=>forn?ehCtrForn(c):ehCtrManut(c)), ativos=CT.filter(c=>c.status==='Ativo');
  const venc90=CT.filter(c=>c.fim&&c.fim<addDias(hoje(),90)&&c.status==='Ativo');
  const reaj=ativos.filter(c=>c.reajuste&&c.reajuste!=='Nenhum'&&String(c.mes_reajuste)===mesN);
  let k;
  if(forn){const mens=ativos.reduce((a,c)=>a+custoMensalForn(c),0);
    k=kpi('Contratos ativos',ativos.length)+kpi('Custo mensal equivalente',money(mens))+kpi('Custo anual',money(mens*12))+
      kpi('Vencem em 90 dias',venc90.length,reaj.length?reaj.length+' reajuste(s) neste mês':'');}
  else{const mrr=ativos.reduce((a,c)=>a+Number(c.valor||0),0);
    k=kpi('Contratos ativos',ativos.length)+kpi('Receita recorrente/mês',money(mrr))+kpi('Receita recorrente/ano',money(mrr*12))+
      kpi('Vencem em 90 dias',venc90.length,reaj.length?reaj.length+' reajuste(s) neste mês':'');}
  v.innerHTML=abas+'<div class="kpis">'+k+'</div>'+
    (forn?'':'<div class="note" style="margin:-4px 0 12px">Só para clientes que assinam o plano mensal. A maioria prefere manutenção sob demanda, que é feita por OS com cobrança avulsa.</div>')+
    '<div class="toolbar"><button class="btn" id="nv">+ Novo contrato de '+(forn?'fornecedor':'manutenção')+'</button>'+
    '<button class="btn sec" id="gen">'+(forn?'Gerar contas a pagar deste mês':'Gerar mensalidades deste mês')+'</button></div>'+
    (reaj.length?'<div class="note" style="margin:-4px 0 10px;color:var(--amber)">Reajuste previsto neste mês: '+
      esc(reaj.map(c=>(forn?c.objeto:c.plano)+' ('+c.reajuste+')').join(', '))+'. Atualize o valor do contrato antes de gerar os lançamentos.</div>':'')+
    '<div class="card"><div class="cbody" id="lst"></div></div>'+
    (forn?'<div class="note">Contratos com periodicidade maior que mensal só geram conta a pagar nos meses de cobrança, contados a partir do início. '+
      'O custo mensal equivalente divide o valor pela periodicidade.</div>':'');
  v.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ctrTab=b.dataset.tab;render()});
  document.getElementById('nv').onclick=()=>editRec('contratos',null,null,{tipo:forn?'Fornecedor':'Cliente',subtipo:forn?undefined:'Manutenção',
    periodicidade:forn?'Mensal':undefined,dia_venc:10,status:'Ativo',inicio:hoje()});
  document.getElementById('gen').onclick=()=>{
    const n=gerarLancContratos(forn?'Fornecedor':'Cliente',mes);
    toast(n?n+(forn?' conta(s) a pagar gerada(s)':' mensalidade(s) gerada(s)'):'Os lançamentos deste mês já existem');render();
  };
  const el=document.getElementById('lst');
  const vig={l:'Vigência',f:r=>{const f=r.fim?diasAte(r.fim):null;return dBR(r.inicio)+' → '+dBR(r.fim)+
    (f!=null&&f>=0&&f<=90?' <span class="bg g-amber">'+f+'d</span>':f!=null&&f<0?' <span class="bg g-red">vencido</span>':'')}};
  const stt={l:'Status',f:r=>'<span class="bg '+bgFor(r.status)+'">'+esc(r.status)+'</span>'};
  const noMes={l:'Neste mês',f:r=>{if(r.status!=='Ativo'||!ctrVenceNoMes(r,mes))return '—';
    return S.financeiro.some(l=>l.contrato===r.id&&mesDe(l.vencimento)===mes)?'<span class="bg g-green">lançado</span>':'<span class="bg g-amber">a gerar</span>'}};
  if(forn)el.innerHTML=tbl([{l:'Fornecedor',s:1,f:r=>esc(nm('fornecedores',r.fornecedor))}].concat(colUnid('contratos'),[
    {l:'Objeto',k:'objeto'},{l:'Categoria',k:'categoria'},{l:'Centro de custo',f:r=>'<span style="font-size:12px">'+esc(nomeCentro('custo',r.centro_custo))+'</span>'},
    {l:'Valor',n:1,f:r=>money(r.valor)+'<div style="font-size:11px;color:var(--faint)">'+esc((r.periodicidade||'Mensal').toLowerCase())+'</div>'},
    {l:'Reajuste',f:r=>r.reajuste&&r.reajuste!=='Nenhum'?esc(r.reajuste)+(r.mes_reajuste?' · '+esc((MESES_OPT.find(m=>m.v===String(r.mes_reajuste))||{}).l||''):''):'—'},
    vig,noMes,stt]),CT,{acts:1,empty:'Nenhum contrato com fornecedor. Cadastre aluguel, licenças, locações e prestadores recorrentes.'});
  else el.innerHTML=tbl([{l:'Cliente',s:1,f:r=>esc(nm('clientes',r.cliente))}].concat(colUnid('contratos'),[{l:'Plano',k:'plano'},
    {l:'Projeto',f:r=>r.obra?esc(nm('obras',r.obra,'codigo')):'—'},{l:'Mensal',n:1,f:r=>money(r.valor)},
    {l:'Visitas/mês',n:1,k:'visitas_mes'},{l:'SLA',n:1,f:r=>r.sla_horas?r.sla_horas+'h':'—'},vig,noMes,stt]),CT,
    {acts:1,empty:'Nenhum cliente com plano de manutenção mensal.'});
  wireTable(el,'contratos');
};

/* ---------- estoque multilocal ---------- */
let estTab='pos';
R.estoque=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="ent">+ Entrada</button>'+
    '<button class="btn sec" id="tra">Transferir</button><button class="btn sec" id="aju">Ajuste</button></div>'+
    '<div class="tabs">'+[['pos','Posição por local'],['mov','Movimentações'],['tec','Com os técnicos']]
      .map(t=>'<button class="tab'+(estTab===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+
    '<div class="card"><div class="cbody" id="bd"></div></div>';
  document.getElementById('ent').onclick=()=>movEstoque('Entrada');
  document.getElementById('tra').onclick=()=>transferir();
  document.getElementById('aju').onclick=()=>movEstoque('Ajuste');
  v.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{estTab=b.dataset.tab;render()});
  const bd=document.getElementById('bd');
  if(estTab==='pos'){
    const locais=U('locais').filter(l=>ativo(l)||S.estoque.some(m=>m.local===l.id));
    const cols=[{l:'Produto',s:1,f:p=>esc(p.nome)},{l:'SKU',k:'sku'}];
    locais.forEach(l=>cols.push({l:l.nome,n:1,f:p=>{const s=saldoProdLocal(p.id,l.id);return s?num(s,2):'<span style="opacity:.35">0</span>'}}));
    cols.push({l:'Total',n:1,f:p=>'<b>'+num(saldoProd(p.id),2)+'</b>'});
    cols.push({l:'Reservado',n:1,f:p=>{const r=reservadoProd(p.id);return r?'<span class="bg g-amber">'+num(r,2)+'</span>':'—'}});
    cols.push({l:'Disponível',n:1,f:p=>{const d=saldoDisponivel(p.id);return '<b style="color:'+(d<0?'var(--red)':'inherit')+'">'+num(d,2)+'</b>'}});
    cols.push({l:'Mínimo',n:1,k:'minimo'});
    cols.push({l:'Situação',f:p=>{const d=saldoDisponivel(p.id),m=Number(p.minimo||0);
      return '<span class="bg '+(d<m?'g-red':d<m*1.3?'g-amber':'g-green')+'">'+(d<m?'Repor':d<m*1.3?'Atenção':'OK')+'</span>'}});
    const linhas=S.produtos.filter(p=>!ehKit(p)&&(ativo(p)||Math.abs(saldoProd(p.id))>0.001));
    const kits=S.produtos.filter(p=>ehKit(p)&&ativo(p));
    bd.innerHTML=tbl(cols,linhas,{empty:'Cadastre produtos em Cadastros.'})+
      (kits.length?'<h4 style="font-size:12.5px;margin:18px 0 5px">Kits — quantos dá para montar com o disponível</h4>'+
      tbl([{l:'Kit',s:1,f:p=>esc(p.nome)},{l:'Composição',f:p=>'<span style="font-size:11.5px">'+esc(descComp(p))+'</span>'},
        {l:'Montáveis',n:1,f:p=>{const m=kitMontavel(p);return '<span class="bg '+(m.n?'g-green':'g-red')+'">'+m.n+'</span>'}},
        {l:'Limitado por',f:p=>{const m=kitMontavel(p);return m.lim?esc(nm('produtos',m.lim)):'—'}}],kits):'')+
      '<div class="note">Disponível = almoxarifado menos o que está reservado para projetos vendidos. O que está com o técnico já tem destino e não entra nesse saldo. Disponível negativo significa que há reserva sem material — é hora de comprar.</div>';
  }else if(estTab==='mov'){
    const mv=U('estoque').slice().sort((a,b)=>String(b.data).localeCompare(String(a.data))).slice(0,150);
    bd.innerHTML=tbl([{l:'Data',f:m=>dBR(m.data)},
      {l:'Tipo',f:m=>'<span class="bg '+(Number(m.qtd)<0?'g-red':'g-green')+'">'+esc(m.tipo)+'</span>'},
      {l:'Produto',s:1,f:m=>esc(nm('produtos',m.produto))},{l:'Local',f:m=>esc(nm('locais',m.local))},
      {l:'Qtd',n:1,f:m=>num(m.qtd,2)},{l:'Projeto',f:m=>m.obra?esc(nm('obras',m.obra,'codigo')):(m.venda?esc(nm('vendas',m.venda,'numero')):'—')},
      {l:'Documento',k:'doc'}],mv,{empty:'Sem movimentações.'});
  }else{
    const tec=U('locais').filter(l=>l.tipo==='Técnico');
    let h='';
    tec.forEach(l=>{
      const itens=S.produtos.filter(p=>!ehKit(p)).map(p=>({id:p.id,nome:p.nome,sku:p.sku,q:saldoProdLocal(p.id,l.id)})).filter(x=>Math.abs(x.q)>0.001);
      h+='<h4 style="font-size:12.5px;margin:12px 0 5px">'+esc(l.nome)+
        (l.responsavel?' · '+esc(nm('colaboradores',l.responsavel)):'')+'</h4>'+
        tbl([{l:'Produto',k:'nome',s:1},{l:'SKU',k:'sku'},{l:'Qtd em posse',n:1,f:x=>num(x.q,2)}],itens,{empty:'Nada em posse.'});
    });
    bd.innerHTML=h||'<div class="empty">Cadastre locais do tipo Técnico para controlar o material em posse da equipe.</div>';
  }
};
function movEstoque(tipo){
  if(!S.produtos.length||!S.locais.length){toast('Cadastre produtos e locais primeiro');return}
  const f=[{k:'produto',l:'Produto',t:'ref',col:'produtos',req:1,filtro:simplesAtivo,rotulo:rotuloProd},{k:'local',l:'Local',t:'ref',col:'locais',req:1},
    {k:'qtd',l:'Quantidade'+(tipo==='Ajuste'?' (use negativo para baixar)':''),t:'number',step:'0.01',req:1},
    {k:'custo',l:'Custo unitário (R$)',t:'money'},{k:'data',l:'Data',t:'date',req:1},{k:'doc',l:'Documento / motivo'}];
  openM(tipo+' de estoque',formHtml(f,{data:hoje()})+'<div class="note">Kits não têm estoque próprio: o saldo deles vem dos componentes.</div>','Registrar',d=>{
    const p=byId('produtos',d.produto);
    put('estoque',{produto:d.produto,local:d.local,tipo:tipo,
      qtd:tipo==='Entrada'?Math.abs(Number(d.qtd)):Number(d.qtd),
      custo:Number(d.custo||(p&&p.custo)||0),data:d.data,doc:d.doc});
    closeM();toast('Movimento registrado');render();
  });
}
function transferir(){
  const f=[{k:'produto',l:'Produto',t:'ref',col:'produtos',req:1,filtro:simplesAtivo,rotulo:rotuloProd},
    {k:'de',l:'De',t:'ref',col:'locais',req:1},{k:'para',l:'Para',t:'ref',col:'locais',req:1},
    {k:'qtd',l:'Quantidade',t:'number',step:'0.01',req:1},{k:'data',l:'Data',t:'date',req:1}];
  openM('Transferir material',formHtml(f,{data:hoje()}),'Transferir',d=>{
    if(d.de===d.para){toast('Origem e destino iguais');return}
    const p=byId('produtos',d.produto),c=Number((p&&p.custo)||0),q=Math.abs(Number(d.qtd));
    const disp=saldoProdLocal(d.produto,d.de);
    if(q>disp&&!confirm('Saldo na origem é '+num(disp,2)+'. Transferir mesmo assim?'))return;
    put('estoque',{produto:d.produto,local:d.de,qtd:-q,tipo:'Transferência',data:d.data,custo:c,doc:'→ '+nm('locais',d.para)});
    put('estoque',{produto:d.produto,local:d.para,qtd:q,tipo:'Transferência',data:d.data,custo:c,doc:'← '+nm('locais',d.de)});
    closeM();toast('Transferência registrada');render();
  });
}

/* ---------- compras e XML ---------- */
R.compras=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Pedido de compra</button>'+
    '<button class="btn sec" id="nf">Fornecedores</button></div>'+
    '<div class="card"><div class="chead"><h2>Importar XML de NF-e</h2><span class="hint">o sistema não emite nota — só importa e concilia</span></div>'+
    '<div class="cbody"><div class="drop" id="drop">Clique aqui ou arraste os arquivos XML de entrada<br>'+
    '<span style="font-size:11px">Lê os itens, dá entrada no estoque, cria a conta a pagar e permite ratear num projeto</span></div>'+
    '<input type="file" id="fx" accept=".xml" multiple style="display:none"></div></div>'+
    '<div class="card"><div class="chead"><h2>Notas importadas</h2></div><div class="cbody" id="lnf"></div></div>'+
    '<div class="card"><div class="chead"><h2>Pedidos de compra</h2></div><div class="cbody" id="lst"></div></div>';
  document.getElementById('nv').onclick=()=>editRec('compras',null);
  document.getElementById('nf').onclick=()=>go('cadastros');
  const drop=document.getElementById('drop'),fx=document.getElementById('fx');
  drop.onclick=()=>fx.click();
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('hot')};
  drop.ondragleave=()=>drop.classList.remove('hot');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('hot');lerXML(e.dataTransfer.files)};
  fx.onchange=()=>lerXML(fx.files);
  const ln=document.getElementById('lnf');
  ln.innerHTML=tbl([{l:'Emissão',f:r=>dBR(r.emissao)},{l:'Fornecedor',s:1,k:'fornecedor_nome'},
    {l:'Chave',f:r=>'<span style="font-size:11px">'+esc(String(r.chave||'').slice(0,12))+'…</span>'},
    {l:'Itens',n:1,f:r=>(r.itens||[]).length},{l:'Valor',n:1,f:r=>money(r.valor)},
    {l:'Projeto',f:r=>r.obra?esc(nm('obras',r.obra,'codigo')):'<span class="bg g-gray">estoque geral</span>'}],
    U('nfe'),{empty:'Nenhum XML importado ainda.'});
  const el=document.getElementById('lst');
  el.innerHTML=tbl([{l:'Emissão',f:r=>dBR(r.emissao)},{l:'Fornecedor',s:1,f:r=>esc(nm('fornecedores',r.fornecedor))},
    {l:'Projeto',f:r=>r.obra?esc(nm('obras',r.obra,'codigo')):'—'},{l:'Itens',k:'descricao'},
    {l:'Valor',n:1,f:r=>money(r.valor)},{l:'Previsão',f:r=>dBR(r.previsao)},
    {l:'Status',f:r=>'<span class="bg '+bgFor(r.status)+'">'+esc(r.status)+'</span>'}],U('compras'),
    {acts:1,empty:'Nenhum pedido de compra.'});
  wireTable(el,'compras');
};
function lerXML(files){
  if(!files||!files.length)return;
  const tarefas=[...files].map(f=>f.text().then(txt=>parseNFe(txt,f.name)).catch(()=>null));
  Promise.all(tarefas).then(rs=>{
    const ok=rs.filter(Boolean);
    if(!ok.length){toast('Nenhum XML de NF-e válido');return}
    conciliarNFe(ok);
  });
}
function parseNFe(txt,fname){
  const doc=new DOMParser().parseFromString(txt,'text/xml');
  if(doc.querySelector('parsererror'))return null;
  const q=(el,t)=>{const n=el?el.getElementsByTagName(t)[0]:null;return n?n.textContent:''};
  const inf=doc.getElementsByTagName('infNFe')[0];
  if(!inf)return null;
  const emit=doc.getElementsByTagName('emit')[0], dest=doc.getElementsByTagName('dest')[0];
  const itens=[...doc.getElementsByTagName('det')].map(d=>{
    const p=d.getElementsByTagName('prod')[0];
    return{cod:q(p,'cProd'),nome:q(p,'xProd'),un:q(p,'uCom'),
      qtd:Number(q(p,'qCom')||0),valor:Number(q(p,'vUnCom')||0)};
  });
  const tot=doc.getElementsByTagName('ICMSTot')[0];
  return{chave:(inf.getAttribute('Id')||fname).replace('NFe',''),
    fornecedor_nome:q(emit,'xNome')||'Fornecedor não identificado',cnpj:q(emit,'CNPJ'),dest_cnpj:q(dest,'CNPJ'),
    emissao:String(q(doc.getElementsByTagName('ide')[0],'dhEmi')||q(doc.getElementsByTagName('ide')[0],'dEmi')).slice(0,10)||hoje(),
    valor:Number(q(tot,'vNF')||itens.reduce((a,i)=>a+i.qtd*i.valor,0)),itens:itens};
}
function conciliarNFe(notas){
  const rep=notas.filter(n=>S.nfe.some(x=>soDig(x.chave)===soDig(n.chave)));
  if(rep.length){toast(rep.length+' nota(s) já importada(s) foram ignoradas');notas=notas.filter(n=>!rep.includes(n))}
  if(!notas.length)return;
  const achada=notas.map(n=>S.empresas.find(e=>n.dest_cnpj&&soDig(e.cnpj)===soDig(n.dest_cnpj))).find(Boolean);
  const empSug=(achada&&achada.id)||UNID||empresaPadrao();
  const alm=[almoxDe(empSug)].filter(Boolean);
  const body='<div class="note" style="margin-bottom:10px">'+notas.length+' nota(s) lida(s). Confira antes de dar entrada.</div>'+
    notas.map(n=>'<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:9px">'+
      '<b>'+esc(n.fornecedor_nome)+'</b> · '+dBR(n.emissao)+' · '+money(n.valor)+
      '<div style="font-size:11.5px;color:var(--faint);margin-top:4px">'+
      n.itens.map(i=>esc(i.nome)+' ('+num(i.qtd,2)+' '+esc(i.un)+')').join(' · ')+'</div></div>').join('')+
    (S.empresas.length?field(campoUnid,empSug)+(achada?'<div class="note" style="margin:-4px 0 8px">Unidade identificada pelo CNPJ do destinatário da nota.</div>':
      (notas.some(n=>n.dest_cnpj)?'<div class="note" style="margin:-4px 0 8px;color:var(--amber)">O CNPJ do destinatário não corresponde a nenhuma empresa cadastrada — confira a unidade.</div>':'')):'')+
    field({k:'local',l:'Dar entrada em qual local',t:'ref',col:'locais',filtro:l=>ativo(l)},alm.length?alm[0].id:'')+
    field({k:'obra',l:'Ratear custo no projeto (opcional)',t:'ref',col:'obras',lab:'codigo'},'')+
    field({k:'venc',l:'Vencimento da conta a pagar',t:'date'},addDias(hoje(),30));
  openM('Conferir importação',body,'Importar',d=>{
    if(!d.local){toast('Escolha o local de entrada');return}
    let novos=0;
    notas.forEach(n=>{
      let forn=S.fornecedores.find(f=>f.cnpj===n.cnpj||f.nome===n.fornecedor_nome);
      if(!forn)forn=put('fornecedores',{nome:n.fornecedor_nome,cnpj:n.cnpj,categoria:'Material'});
      n.itens.forEach(i=>{
        let p=S.produtos.find(x=>!ehKit(x)&&(x.sku===i.cod||String(x.nome).toLowerCase()===String(i.nome).toLowerCase()));
        if(!p){p=put('produtos',{tipo:'Simples',status:'Ativo',sku:i.cod||('IMP-'+uid().slice(0,4)),nome:i.nome,unidade:i.un,
          custo:i.valor,venda:i.valor*1.25,minimo:0,fornecedor:forn.id});novos++}
        else{p.custo=i.valor;put('produtos',p)}
        put('estoque',{produto:p.id,local:d.local,qtd:Math.abs(i.qtd),tipo:'Entrada',data:n.emissao,
          custo:i.valor,obra:d.obra||'',doc:'NF-e '+String(n.chave).slice(-8)});
      });
      const em=d.empresa||empDe('locais',byId('locais',d.local));
      put('nfe',{chave:n.chave,fornecedor:forn.id,fornecedor_nome:n.fornecedor_nome,emissao:n.emissao,dest_cnpj:n.dest_cnpj||'',
        valor:n.valor,itens:n.itens,obra:d.obra||'',empresa:em});
      put('financeiro',{tipo:'Pagar',descricao:'NF-e '+String(n.chave).slice(-8)+' · '+n.fornecedor_nome,
        categoria:'Material',valor:n.valor,vencimento:d.venc,fornecedor:forn.id,obra:d.obra||'',empresa:em,status:'Pendente'});
    });
    closeM();toast('Importado — estoque e contas atualizados'+(novos?' · '+novos+' produto(s) criados':''));render();
  },true);
}
/* ---------- financeiro ---------- */
R.financeiro=v=>{
  const pend=U('financeiro').filter(l=>l.status==='Pendente'||l.status==='Atrasado');
  const rec=pend.filter(l=>l.tipo==='Receber').reduce((a,l)=>a+Number(l.valor||0),0);
  const pag=pend.filter(l=>l.tipo==='Pagar').reduce((a,l)=>a+Number(l.valor||0),0);
  const venc=contasVencidas();
  v.innerHTML='<div class="kpis">'+kpi('A receber em aberto',money(rec))+kpi('A pagar em aberto',money(pag))+
    kpi('Saldo projetado',money(rec-pag))+kpi('Vencidas',venc.length,money(venc.reduce((a,l)=>a+Number(l.valor||0),0)))+'</div>'+
    '<div class="toolbar"><button class="btn" id="nv">+ Lançamento</button>'+
    '<select id="ft"><option value="">Receber e pagar</option><option>Receber</option><option>Pagar</option></select>'+
    '<select id="fs"><option value="">Todos os status</option><option>Pendente</option><option>Pago</option>'+
    '<option>Recebido</option><option>Atrasado</option></select></div>'+
    '<div class="card"><div class="cbody" id="lst"></div></div>';
  document.getElementById('nv').onclick=()=>editRec('financeiro',null);
  const draw=()=>{
    const ft=document.getElementById('ft').value,fs=document.getElementById('fs').value;
    const rows=U('financeiro').filter(l=>(!ft||l.tipo===ft)&&(!fs||l.status===fs))
      .sort((a,b)=>String(a.vencimento).localeCompare(String(b.vencimento)));
    const el=document.getElementById('lst');
    el.innerHTML=tbl([{l:'Venc.',f:l=>dBR(l.vencimento)},
      {l:'Tipo',f:l=>'<span class="bg '+(l.tipo==='Receber'?'g-green':'g-amber')+'">'+esc(l.tipo)+'</span>'},
      {l:'Descrição',k:'descricao',s:1}].concat(colUnid('financeiro'),[{l:'Categoria',k:'categoria'},
      {l:'Parte',f:l=>esc(l.cliente?nm('clientes',l.cliente):l.fornecedor?nm('fornecedores',l.fornecedor):'—')},
      {l:'Projeto',f:l=>l.obra?esc(nm('obras',l.obra,'codigo')):'—'},
      {l:'Valor',n:1,f:l=>money(l.valor)},
      {l:'Status',f:l=>{const atr=l.status==='Pendente'&&l.vencimento<hoje();
        return '<span class="bg '+(atr?'g-red':bgFor(l.status))+'">'+(atr?'Vencido':esc(l.status))+'</span>'}},
      {l:'',n:1,f:l=>(l.status==='Pendente'||l.status==='Atrasado')?'<button class="btn sec sm" data-lq="'+l.id+'">Liquidar</button>':''}]),
      rows,{acts:1,empty:'Nenhum lançamento.'});
    wireTable(el,'financeiro');
    el.querySelectorAll('[data-lq]').forEach(b=>b.onclick=e=>{e.stopPropagation();
      const l=byId('financeiro',b.dataset.lq);l.status=l.tipo==='Receber'?'Recebido':'Pago';l.pagamento=hoje();
      put('financeiro',l);toast('Liquidado');render()});
  };
  document.getElementById('ft').onchange=draw;document.getElementById('fs').onchange=draw;draw();
};

/* ---------- fluxo de caixa ---------- */
function ajusteDe(emp){return S.ajustes.find(a=>(a.empresa||empresaPadrao())===emp)||null}
function cfgFluxo(){
  if(UNID){const a=ajusteDe(UNID)||{};return{saldo_inicial:Number(a.saldo_inicial||0),custo_fixo:Number(a.custo_fixo||0)}}
  return S.ajustes.reduce((t,a)=>({saldo_inicial:t.saldo_inicial+Number(a.saldo_inicial||0),custo_fixo:t.custo_fixo+Number(a.custo_fixo||0)}),{saldo_inicial:0,custo_fixo:0});
}
R.fluxo=v=>{
  const cfg=cfgFluxo(), F=U('financeiro');
  const meses=[];let m=mesDe(hoje());
  for(let i=0;i<6;i++){meses.push(m);m=shiftMes(m,1)}
  const ent=meses.map(mm=>F.filter(l=>l.tipo==='Receber'&&mesDe(l.vencimento)===mm).reduce((a,l)=>a+Number(l.valor||0),0));
  const sai=meses.map(mm=>F.filter(l=>l.tipo==='Pagar'&&mesDe(l.vencimento)===mm).reduce((a,l)=>a+Number(l.valor||0),0));
  const fixo=cfg.custo_fixo;
  let saldo=cfg.saldo_inicial;const acum=meses.map((_,i)=>{saldo+=ent[i]-sai[i]-fixo;return saldo});
  const podeAjustar=UNID||!multiUnid();
  v.innerHTML='<div class="kpis">'+kpi('Saldo inicial',money(cfg.saldo_inicial),!UNID&&multiUnid()?'soma das unidades':'')+
    kpi('Entradas 6 meses',money(ent.reduce((a,b)=>a+b,0)))+
    kpi('Saídas 6 meses',money(sai.reduce((a,b)=>a+b,0)+fixo*6))+
    kpi('Saldo ao final',money(acum[acum.length-1]||0))+'</div>'+
    '<div class="card"><div class="chead"><h2>Projeção</h2>'+(podeAjustar?'<button class="btn sec sm" id="cfg">Ajustar saldo e custo fixo</button>':
      '<span class="hint">escolha uma unidade no topo para ajustar saldo e custo fixo</span>')+'</div>'+
    '<div class="cbody"><div id="ch"></div>'+
    '<div style="display:flex;gap:14px;font-size:11.5px;color:var(--dim);margin-top:6px">'+
    '<span><b style="color:var(--green)">■</b> entradas</span><span><b style="color:var(--red)">■</b> saídas</span></div></div></div>'+
    '<div class="card"><div class="cbody" id="tb"></div></div>'+
    (!UNID&&multiUnid()?'<div class="card"><div class="chead"><h2>Saldo por unidade</h2><span class="hint">ao final dos 6 meses</span></div><div class="cbody" id="pu"></div></div>':'');
  chartBars(document.getElementById('ch'),[ent,sai.map(s=>s+fixo)],meses.map(mesLabel),['var(--green)','var(--red)']);
  document.getElementById('tb').innerHTML=tbl([{l:'Mês',k:'m',s:1},{l:'Entradas',n:1,f:r=>money(r.e)},
    {l:'Saídas',n:1,f:r=>money(r.s)},{l:'Custo fixo',n:1,f:r=>money(fixo)},
    {l:'Resultado',n:1,f:r=>money(r.e-r.s-fixo)},
    {l:'Saldo acumulado',n:1,f:r=>'<span class="bg '+(r.a<0?'g-red':'g-green')+'">'+money(r.a)+'</span>'}],
    meses.map((mm,i)=>({id:'m'+i,m:mesLabel(mm),e:ent[i],s:sai[i],a:acum[i]})));
  const pu=document.getElementById('pu');
  if(pu)pu.innerHTML=tbl([{l:'Unidade',s:1,f:r=>esc(nomeUnid(r.id))},{l:'Saldo hoje',n:1,f:r=>money(r.ini)},
    {l:'Entradas',n:1,f:r=>money(r.e)},{l:'Saídas + fixo',n:1,f:r=>money(r.s)},
    {l:'Saldo final',n:1,f:r=>'<span class="bg '+(r.fin<0?'g-red':'g-green')+'">'+money(r.fin)+'</span>'}],
    S.empresas.filter(e=>ativo(e)).map(e=>{const a=ajusteDe(e.id)||{},Fe=S.financeiro.filter(l=>empDe('financeiro',l)===e.id&&meses.includes(mesDe(l.vencimento)));
      const en=Fe.filter(l=>l.tipo==='Receber').reduce((x,l)=>x+Number(l.valor||0),0),
        sa=Fe.filter(l=>l.tipo==='Pagar').reduce((x,l)=>x+Number(l.valor||0),0)+Number(a.custo_fixo||0)*6;
      return{id:e.id,ini:Number(a.saldo_inicial||0),e:en,s:sa,fin:Number(a.saldo_inicial||0)+en-sa}}));
  const cb=document.getElementById('cfg');
  if(cb)cb.onclick=()=>{
    const emp=UNID||empresaPadrao(), atual=(emp?ajusteDe(emp):S.ajustes[0])||{};
    const f=[{k:'saldo_inicial',l:'Saldo em caixa hoje (R$)',t:'money'},{k:'custo_fixo',l:'Custo fixo mensal (R$)',t:'money'}];
    openM('Parâmetros do fluxo'+(emp?' · '+nomeUnid(emp):''),formHtml(f,atual),'Salvar',d=>{
      put('ajustes',Object.assign({},atual,{saldo_inicial:d.saldo_inicial,custo_fixo:d.custo_fixo},emp?{empresa:emp}:{}));closeM();render()});
  };
};

/* ---------- DRE gerencial ---------- */
function dreCalc(ano,pertence){
  const noAno=l=>String(l.vencimento||'').startsWith(ano);
  const vertDe=l=>{const o=l.obra?byId('obras',l.obra):null;if(o&&o.vertical)return o.vertical;
    const vd=l.venda?byId('vendas',l.venda):null;if(vd&&vd.vertical)return vd.vertical;
    const c=l.cliente?byId('clientes',l.cliente):null;return (c&&c.vertical)||'Outros'};
  const F=S.financeiro.filter(l=>noAno(l)&&pertence('financeiro',l));
  const porVert={};VERTICAIS.concat(['Outros']).forEach(x=>porVert[x]=0);
  F.filter(l=>l.tipo==='Receber').forEach(l=>{const k=vertDe(l);porVert[k]=(porVert[k]||0)+Number(l.valor||0)});
  const receita=Object.values(porVert).reduce((a,b)=>a+b,0);
  const cat=c=>F.filter(l=>l.tipo==='Pagar'&&l.categoria===c).reduce((a,l)=>a+Number(l.valor||0),0);
  const mo=S.apontamentos.filter(a=>String(a.data||'').startsWith(ano)&&pertence('apontamentos',a)).reduce((acc,a)=>{
    const c=byId('colaboradores',a.colaborador);return acc+Number(a.horas||0)*Number((c&&c.custo_hora)||0)},0);
  const r={porVert:porVert,receita:receita,material:cat('Material'),terceiros:cat('Terceiros'),mo:mo,
    mkt:cat('Marketing'),adm:cat('Administrativo'),imp:cat('Impostos')+cat('Outros')};
  r.cd=r.material+r.terceiros+r.mo;r.mc=r.receita-r.cd;r.desp=r.mkt+r.adm+r.imp;r.res=r.mc-r.desp;
  return r;
}
function dreCentros(ano,pertence){
  const L={},C={},lz=k=>L[k]=L[k]||{id:k,rec:0,cd:0},cz=k=>C[k]=C[k]||{id:k,mat:0,mo:0,ter:0,desp:0};
  S.financeiro.filter(l=>String(l.vencimento||'').startsWith(ano)&&pertence('financeiro',l)).forEach(l=>{
    const v=Number(l.valor||0),cl=centroDe('lucro','financeiro',l),cc=centroDe('custo','financeiro',l);
    if(l.tipo==='Receber'){lz(cl).rec+=v;return}
    if(l.categoria==='Material'){lz(cl).cd+=v;cz(cc).mat+=v}
    else if(l.categoria==='Terceiros'){lz(cl).cd+=v;cz(cc).ter+=v}
    else cz(cc).desp+=v;
  });
  S.apontamentos.filter(a=>String(a.data||'').startsWith(ano)&&pertence('apontamentos',a)).forEach(a=>{
    const c=byId('colaboradores',a.colaborador),v=Number(a.horas||0)*Number((c&&c.custo_hora)||0);
    lz(centroDe('lucro','apontamentos',a)).cd+=v;cz(centroDe('custo','apontamentos',a)).mo+=v;
  });
  const ord=(a,b)=>(!a.id)-(!b.id)||String(nomeCentro('x',a.id)).localeCompare(String(nomeCentro('x',b.id)));
  return{lucro:Object.values(L).sort((a,b)=>b.rec-a.rec),custo:Object.values(C).sort((a,b)=>(!a.id)-(!b.id)||(b.mat+b.mo+b.ter+b.desp)-(a.mat+a.mo+a.ter+a.desp))};
}
R.dre=v=>{
  const ano=hoje().slice(0,4), d=dreCalc(ano,naUnid), receita=d.receita;
  const lin=(l,x,b,neg)=>'<tr><td'+(b?' class="s"':'')+'>'+l+'</td><td class="n'+(b?' s':'')+'">'+
    (neg?'('+money(x)+')':money(x))+'</td><td class="n">'+(receita?pct(x/receita*100):'—')+'</td></tr>';
  const porUnid=!UNID&&multiUnid();
  v.innerHTML='<div class="kpis">'+kpi('Receita '+ano,money(receita))+kpi('Custo direto',money(d.cd))+
    kpi('Margem de contribuição',receita?pct(d.mc/receita*100):'—',money(d.mc))+
    kpi('Resultado',money(d.res),receita?pct(d.res/receita*100)+' da receita':'')+'</div>'+
    '<div class="cols21">'+
    '<div class="card"><div class="chead"><h2>DRE gerencial · '+ano+(UNID?' · '+esc(nomeUnid(UNID)):porUnid?' · consolidado':'')+'</h2>'+
    '<span class="hint">regime de competência simplificado</span></div>'+
    '<div class="cbody scr"><table><thead><tr><th>Linha</th><th class="n">Valor</th><th class="n">% receita</th></tr></thead><tbody>'+
    lin('Receita bruta',receita,1)+VERTICAIS.map(x=>lin('&nbsp;&nbsp;'+x,d.porVert[x]||0)).join('')+
    (d.porVert['Outros']?lin('&nbsp;&nbsp;Outros',d.porVert['Outros']):'')+
    lin('(−) Material aplicado',d.material,0,1)+lin('(−) Mão de obra técnica',d.mo,0,1)+lin('(−) Terceiros',d.terceiros,0,1)+
    lin('= Margem de contribuição',d.mc,1)+
    lin('(−) Marketing',d.mkt,0,1)+lin('(−) Administrativo',d.adm,0,1)+lin('(−) Impostos e outros',d.imp,0,1)+
    lin('= Resultado do período',d.res,1)+
    '</tbody></table></div></div>'+
    '<div class="card"><div class="chead"><h2>Receita por vertical</h2></div><div class="cbody"><div id="cv"></div></div></div></div>'+
    (porUnid?'<div class="card"><div class="chead"><h2>Resultado por unidade · '+ano+'</h2></div><div class="cbody" id="du"></div></div>':'')+
    '<div class="card"><div class="chead"><h2>Resultado por centro de lucro · '+ano+'</h2></div><div class="cbody" id="dl"></div></div>'+
    '<div class="card"><div class="chead"><h2>Custos e despesas por centro de custo · '+ano+'</h2></div><div class="cbody" id="dc"></div></div>'+
    '<div class="note">Mão de obra vem dos apontamentos de hora, não de lançamentos financeiros — é o custo real aplicado nos projetos, incluindo as horas de garantia.'+
    (porUnid?' Cada lançamento pertence à unidade informada nele ou, na falta, à unidade do projeto ou venda de origem.':'')+'</div>';
  chartBars(document.getElementById('cv'),[VERTICAIS.map(x=>d.porVert[x]||0)],VERTICAIS,['var(--brand)']);
  const dc=dreCentros(ano,naUnid);
  document.getElementById('dl').innerHTML=tbl([{l:'Centro de lucro',s:1,f:r=>esc(nomeCentro('lucro',r.id))},
    {l:'Receita',n:1,f:r=>money(r.rec)},{l:'Custo direto',n:1,f:r=>money(r.cd)},
    {l:'Margem de contribuição',n:1,f:r=>money(r.rec-r.cd)+' '+badgeMg(r.rec?(r.rec-r.cd)/r.rec*100:null)},
    {l:'% da receita',n:1,f:r=>receita?pct(r.rec/receita*100):'—'}],dc.lucro,{empty:'Sem movimento no ano.'});
  document.getElementById('dc').innerHTML=tbl([{l:'Centro de custo',s:1,f:r=>esc(nomeCentro('custo',r.id))},
    {l:'Material',n:1,f:r=>money(r.mat)},{l:'Mão de obra',n:1,f:r=>money(r.mo)},{l:'Terceiros',n:1,f:r=>money(r.ter)},
    {l:'Despesas',n:1,f:r=>money(r.desp)},{l:'Total',n:1,f:r=>'<b>'+money(r.mat+r.mo+r.ter+r.desp)+'</b>'}],dc.custo,{empty:'Sem movimento no ano.'})+
    (dc.custo.some(r=>!r.id)?'<div class="note">"Sem centro" reúne lançamentos sem centro de custo informado e sem projeto de origem. Edite o lançamento para classificá-lo.</div>':'');
  const du=document.getElementById('du');
  if(du){
    const rows=S.empresas.filter(e=>ativo(e)).map(e=>Object.assign({id:e.id},dreCalc(ano,(col,r)=>empDe(col,r)===e.id)));
    du.innerHTML=tbl([{l:'Unidade',s:1,f:r=>esc(nomeUnid(r.id))},{l:'Receita',n:1,f:r=>money(r.receita)},
      {l:'Custo direto',n:1,f:r=>money(r.cd)},{l:'Margem contrib.',n:1,f:r=>r.receita?pct(r.mc/r.receita*100):'—'},
      {l:'Despesas',n:1,f:r=>money(r.desp)},
      {l:'Resultado',n:1,f:r=>'<span class="bg '+(r.res<0?'g-red':'g-green')+'">'+money(r.res)+'</span>'},
      {l:'% do grupo',n:1,f:r=>receita?pct(r.receita/receita*100):'—'}],rows);
  }
};

/* ---------- marketing ---------- */
const CANAIS_PADRAO=[['Online','Google Ads'],['Online','Meta'],['Online','TikTok'],['Online','Outros'],
  ['Offline','Parcerias'],['Offline','Empresas de relacionamento'],['Offline','Indicação'],['Offline','Outros']];
const CANAL_ANTIGO={'instagram':['Online','Meta'],'meta':['Online','Meta'],'facebook':['Online','Meta'],'google':['Online','Google Ads'],
  'google ads':['Online','Google Ads'],'tiktok':['Online','TikTok'],'site':['Online','Outros'],'indicação arquiteto':['Offline','Indicação'],
  'indicação':['Offline','Indicação'],'construtora parceira':['Offline','Parcerias'],'parcerias':['Offline','Parcerias'],
  'feira':['Offline','Outros'],'base de clientes':['Offline','Outros'],'outro':['Offline','Outros']};
function canaisPadrao(){
  const garantir=(tp,n)=>S.canais.find(c=>c.tipo===tp&&String(c.nome).toLowerCase()===n.toLowerCase())||put('canais',{tipo:tp,nome:n,status:'Ativa'});
  CANAIS_PADRAO.forEach(c=>garantir(c[0],c[1]));
  let conv=0;
  ['oportunidades','campanhas','vendas'].forEach(col=>S[col].forEach(r=>{
    if(r.canal&&!byId('canais',r.canal)){const m=CANAL_ANTIGO[String(r.canal).toLowerCase()];
      if(m){r.canal=garantir(m[0],m[1]).id;put(col,r);conv++}}}));
  return conv;
}
function resultadoCanais(){
  const mapa={};
  const linha=k=>mapa[k]=mapa[k]||{canal:k,n:0,ganho:0,vendas:0,receita:0,inv:0};
  S.canais.forEach(c=>{if(ativo(c))linha(c.id)});
  S.oportunidades.forEach(o=>{const l=linha(o.canal||'');l.n++;if(o.estagio==='Ganho')l.ganho++});
  U('vendas').filter(v=>v.status!=='Cancelada').forEach(v=>{const l=linha(v.canal||'');l.vendas++;l.receita+=Number(v.valor||0)});
  S.campanhas.forEach(c=>{if(c.canal)linha(c.canal).inv+=Number(c.investido||0)});
  return Object.values(mapa).map((l,i)=>Object.assign(l,{id:'k'+i,
    tipo:(byId('canais',l.canal)||{}).tipo||(l.canal?'Antigo':'—'),nome:canalNome(l.canal)}));
}
const roiBadge=r=>r.inv?'<span class="bg '+(r.receita/r.inv<3?'g-red':r.receita/r.inv<8?'g-amber':'g-green')+'">'+
  (r.receita/r.inv).toFixed(1).replace('.',',')+'×</span>':'—';
R.marketing=v=>{
  const L=resultadoCanais();
  const inv=S.campanhas.reduce((a,c)=>a+Number(c.investido||0),0), ops=S.oportunidades.length;
  const rec=L.reduce((a,l)=>a+l.receita,0);
  const porTipo=['Online','Offline'].map((t,i)=>{const ls=L.filter(l=>l.tipo===t);
    return{id:'t'+i,tipo:t,n:ls.reduce((a,l)=>a+l.n,0),vendas:ls.reduce((a,l)=>a+l.vendas,0),
      receita:ls.reduce((a,l)=>a+l.receita,0),inv:ls.reduce((a,l)=>a+l.inv,0)}});
  v.innerHTML='<div class="kpis">'+kpi('Investido em campanhas',money(inv))+kpi('Oportunidades',ops)+
    kpi('Custo por oportunidade',ops&&inv?money(inv/ops):'—')+
    kpi('Receita de vendas atribuída',money(rec),inv?'ROI '+(rec/inv).toFixed(1).replace('.',',')+'×':'')+'</div>'+
    (S.canais.length?'':'<div class="card"><div class="cbody"><div class="empty">Nenhum canal cadastrado. '+
      '<button class="btn sm" id="cp">Cadastrar canais padrão</button></div></div></div>')+
    '<div class="card"><div class="chead"><h2>Online × Offline</h2></div><div class="cbody" id="lt"></div></div>'+
    '<div class="card"><div class="chead"><h2>Resultado por canal</h2><span class="hint">da oportunidade até a venda fechada</span></div>'+
    '<div class="cbody" id="lk"></div></div>';
  const cp=document.getElementById('cp');if(cp)cp.onclick=()=>{canaisPadrao();toast('Canais cadastrados');render()};
  const cols=[{l:'Oportunidades',n:1,k:'n'},{l:'Vendas',n:1,k:'vendas'},
    {l:'Conversão',n:1,f:r=>r.n?pct(r.vendas/r.n*100):'—'},{l:'Investido',n:1,f:r=>r.inv?money(r.inv):'—'},
    {l:'Receita',n:1,f:r=>money(r.receita)},{l:'Ticket médio',n:1,f:r=>r.vendas?money(r.receita/r.vendas):'—'},{l:'Retorno',n:1,f:roiBadge}];
  document.getElementById('lt').innerHTML=tbl([{l:'Tipo',k:'tipo',s:1}].concat(cols),porTipo);
  document.getElementById('lk').innerHTML=tbl([{l:'Canal',s:1,f:r=>esc(r.nome)}].concat(cols),
    L.sort((a,b)=>b.receita-a.receita||b.n-a.n),{empty:'Cadastre canais e registre o canal nas oportunidades.'})+
    '<div class="note">A receita vem das vendas fechadas, pelo canal da oportunidade que as originou. O investido vem das campanhas vinculadas a cada canal.</div>';
};
R.campanhas=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="nc">+ Nova campanha</button></div>'+
    '<div class="card"><div class="cbody" id="lc"></div></div>';
  document.getElementById('nc').onclick=()=>editRec('campanhas',null);
  const lc=document.getElementById('lc');
  lc.innerHTML=tbl([{l:'Campanha',k:'nome',s:1},{l:'Canal',f:r=>esc(canalNome(r.canal))},{l:'Vertical',k:'vertical'},
    {l:'Período',f:r=>dBR(r.inicio)+' → '+dBR(r.fim)},{l:'Orçamento',n:1,f:r=>money(r.orcamento)},
    {l:'Investido',n:1,f:r=>money(r.investido)},{l:'Leads',n:1,k:'leads'},
    {l:'CPL',n:1,f:r=>Number(r.leads)?money(Number(r.investido||0)/Number(r.leads)):'—'},
    {l:'Oport.',n:1,f:r=>S.oportunidades.filter(o=>o.campanha===r.id).length},
    {l:'Status',f:r=>'<span class="bg '+(r.status==='No ar'?'g-green':'g-gray')+'">'+esc(r.status||'—')+'</span>'}],
    S.campanhas,{acts:1,empty:'Nenhuma campanha cadastrada.'});
  wireTable(lc,'campanhas');
};
R.canais=v=>{
  const falta=CANAIS_PADRAO.some(c=>!S.canais.some(x=>x.tipo===c[0]&&x.nome.toLowerCase()===c[1].toLowerCase()));
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Novo canal</button>'+
    (falta?'<button class="btn sec sm" id="cp">Cadastrar canais padrão</button>':'')+
    '<label style="font-size:12.5px;color:var(--dim);display:flex;gap:6px;align-items:center"><input type="checkbox" id="fCa"'+
    (verCancelados?' checked':'')+'> mostrar cancelados</label></div>'+
    ['Online','Offline'].map(t=>'<div class="card"><div class="chead"><h2>'+t+'</h2></div><div class="cbody" id="l'+t+'"></div></div>').join('')+
    '<div class="note">Os canais aparecem para escolha na oportunidade e na campanha. Cancelar um canal não altera o histórico: ele só deixa de aparecer em cadastros novos.</div>';
  document.getElementById('nv').onclick=()=>editRec('canais',null);
  const cp=document.getElementById('cp');
  if(cp)cp.onclick=()=>{const n=canaisPadrao();toast('Canais cadastrados'+(n?' · '+n+' registro(s) antigos convertidos':''));render()};
  document.getElementById('fCa').onchange=e=>{verCancelados=e.target.checked;render()};
  const L=resultadoCanais();
  ['Online','Offline'].forEach(t=>{
    const el=document.getElementById('l'+t);
    const rows=S.canais.filter(c=>c.tipo===t&&(verCancelados||ativo(c))).sort((a,b)=>(ativo(b)-ativo(a))||a.nome.localeCompare(b.nome));
    el.innerHTML=tbl([{l:'Canal',k:'nome',s:1},{l:'Descrição',k:'descricao'},
      {l:'Oportunidades',n:1,f:r=>(L.find(l=>l.canal===r.id)||{}).n||0},
      {l:'Vendas',n:1,f:r=>(L.find(l=>l.canal===r.id)||{}).vendas||0},
      {l:'Receita',n:1,f:r=>money((L.find(l=>l.canal===r.id)||{}).receita||0)},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativo':'Cancelado')+'</span>'}],
      rows,{acts:1,empty:'Nenhum canal '+t.toLowerCase()+'.'});
    wireTable(el,'canais');
  });
};
R.concorrentes=v=>{
  v.innerHTML='<div class="toolbar"><button class="btn" id="nk">+ Novo concorrente</button></div>'+
    '<div class="card"><div class="cbody" id="lx"></div></div>';
  document.getElementById('nk').onclick=()=>editRec('concorrentes',null);
  const lx=document.getElementById('lx');
  lx.innerHTML=tbl([{l:'Empresa',k:'nome',s:1},{l:'Atuação',k:'atuacao'},{l:'Faixa',k:'faixa'},
    {l:'Pontos fortes',k:'fortes'},{l:'Última observação',k:'ultima'}],
    S.concorrentes,{acts:1,empty:'Nenhum concorrente monitorado.'});
  wireTable(lx,'concorrentes');
};

/* ---------- produtos: simples e kit ---------- */
const UNIDADES=['un','pç','par','m','rolo','cx','conj','kit'];
function editarProduto(id,after){
  const orig=id?byId('produtos',id):null;
  const p=orig?JSON.parse(JSON.stringify(orig)):{tipo:'Simples',status:'Ativo',unidade:'un',componentes:[]};
  p.tipo=tipoProd(p);p.componentes=p.componentes||[];
  const travado=orig&&(S.estoque.some(m=>m.produto===orig.id)||S.produtos.some(k=>ehKit(k)&&(k.componentes||[]).some(c=>c.produto===orig.id)));
  const fim=()=>{closeM();after?after():render()};
  const ler=()=>modal.querySelectorAll('[data-k]').forEach(el=>{
    if(el.dataset.k==='id')return;p[el.dataset.k]=el.type==='number'?(el.value===''?0:Number(el.value)):el.value});
  const draw=()=>{
    const kit=p.tipo==='Kit';
    const fams=S.familias.filter(ativo), cats=S.categorias.filter(ativo);
    const selClass=(k,l,lista,col)=>{
      const v=p[k]||'', antigo=v&&!lista.some(x=>x.id===v);
      return '<label class="f"><span>'+l+' *</span><select data-k="'+k+'"><option value=""></option>'+
        (antigo?'<option value="'+esc(v)+'" selected>'+esc(nomeClass(col,v))+(byId(col,v)?' (cancelada)':' (antigo)')+'</option>':'')+
        lista.slice().sort((a,b)=>a.nome.localeCompare(b.nome)).map(x=>'<option value="'+x.id+'"'+(x.id===v?' selected':'')+'>'+esc(x.nome)+'</option>').join('')+
        '</select></label>'};
    let h='<div class="tabs" style="margin-bottom:12px">'+['Simples','Kit'].map(t=>
      '<button class="tab'+(p.tipo===t?' on':'')+'" data-tp="'+t+'"'+(travado&&p.tipo!==t?' disabled title="Produto já movimentado ou usado em kit"':'')+'>'+t+'</button>').join('')+'</div>';
    if(!fams.length||!cats.length)h+='<div class="note" style="color:var(--amber);margin:0 0 10px">Cadastre ao menos uma '+
      (!fams.length?'família':'categoria')+' em Cadastros antes de salvar o produto.</div>';
    h+='<div class="frow"><label class="f"><span>SKU *</span><input type="text" data-k="sku" value="'+esc(p.sku||'')+'"></label>'+
      '<label class="f"><span>Descrição *</span><input type="text" data-k="nome" value="'+esc(p.nome||'')+'"></label></div>'+
      '<div class="frow">'+selClass('familia','Família',fams,'familias')+selClass('categoria','Categoria',cats,'categorias')+'</div>'+
      '<div class="frow"><label class="f"><span>Unidade</span><select data-k="unidade">'+
        UNIDADES.map(u=>'<option'+(p.unidade===u?' selected':'')+'>'+u+'</option>').join('')+'</select></label>';
    if(!kit){
      h+='<label class="f"><span>Fornecedor padrão</span><select data-k="fornecedor"><option value=""></option>'+
        S.fornecedores.map(f=>'<option value="'+f.id+'"'+(p.fornecedor===f.id?' selected':'')+'>'+esc(f.nome)+'</option>').join('')+'</select></label></div>'+
        '<div class="frow"><label class="f"><span>Custo (R$)</span><input type="number" step="0.01" data-k="custo" value="'+Number(p.custo||0)+'"></label>'+
        '<label class="f"><span>Preço de venda (R$)</span><input type="number" step="0.01" data-k="venda" value="'+Number(p.venda||0)+'"></label></div>'+
        '<label class="f"><span>Estoque mínimo</span><input type="number" step="1" data-k="minimo" value="'+Number(p.minimo||0)+'"></label>';
    }else{
      const custo=custoProduto(p), sug=vendaComponentes(p), v=Number(p.venda||0);
      h+='<label class="f"><span>Preço de venda do kit (R$)</span><input type="number" step="0.01" data-k="venda" value="'+v+'"></label></div>'+
        '<div style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;margin:6px 0 5px">Componentes</div>'+
        '<div class="scr"><table><thead><tr><th>Item</th><th class="n">Qtd</th><th class="n">Custo un.</th><th class="n">Subtotal</th><th></th></tr></thead><tbody>'+
        (p.componentes.length?p.componentes.map((c,i)=>{const cp=byId('produtos',c.produto)||{};
          return '<tr><td class="s">'+esc(cp.nome||'—')+(ativo(cp)?'':' <span class="bg g-red">cancelado</span>')+'</td>'+
            '<td class="n"><input type="number" step="0.01" data-cq="'+i+'" value="'+Number(c.qtd)+'" style="width:72px"></td>'+
            '<td class="n">'+money(cp.custo)+'</td><td class="n">'+money(Number(c.qtd)*Number(cp.custo||0))+'</td>'+
            '<td class="n"><button class="btn sec sm" data-cr="'+i+'">×</button></td></tr>'}).join(''):
          '<tr><td colspan="5" class="empty">Adicione os itens que formam o kit.</td></tr>')+
        '</tbody></table></div>'+
        '<div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap"><select id="cpP" style="flex:1;min-width:180px"><option value="">Adicionar componente…</option>'+
          S.produtos.filter(x=>simplesAtivo(x)&&x.id!==p.id).sort((a,b)=>a.nome.localeCompare(b.nome))
            .map(x=>'<option value="'+x.id+'">'+esc(rotuloProd(x))+'</option>').join('')+'</select>'+
          '<input type="number" step="0.01" id="cpQ" value="1" style="width:80px"><button class="btn sec sm" id="cpA">Adicionar</button></div>'+
        '<div class="kpis" style="margin:10px 0 0">'+kpi('Custo do kit',money(custo))+kpi('Soma das vendas avulsas',money(sug))+
          kpi('Margem do kit',v?pct((v-custo)/v*100):'—',v&&sug?(v<sug?'desconto de '+pct((sug-v)/sug*100)+' vs. avulso':''):'')+'</div>'+
        (sug&&!v?'<button class="btn sec sm" id="usaSug">Usar soma avulsa como preço</button>':'')+
        '<div class="note">O custo do kit é calculado pelos componentes e se atualiza sozinho quando o custo deles muda. Kit não tem estoque próprio: ao reservar ou baixar um kit, o sistema movimenta cada componente.</div>';
    }
    if(orig)h+='<div style="margin-top:12px"><button class="btn '+(ativo(p)?'dgr':'sec')+' sm" id="pCan">'+(ativo(p)?'Cancelar produto':'Reativar produto')+'</button></div>';
    modal.className='wide';
    modal.innerHTML='<div class="mhead"><h3>'+(orig?'Editar produto':'Novo produto')+(ativo(p)?'':' <span class="bg g-red">cancelado</span>')+'</h3>'+
      '<button class="x" onclick="closeM()">&times;</button></div><div class="mbody">'+h+'</div>'+
      '<div class="mfoot"><button class="btn sec" onclick="closeM()">Fechar</button><button class="btn" id="pSv">Salvar</button></div>';
    ovl.classList.add('on');
    modal.querySelectorAll('[data-tp]').forEach(b=>b.onclick=()=>{if(b.disabled)return;ler();p.tipo=b.dataset.tp;draw()});
    modal.querySelectorAll('[data-cq]').forEach(el=>el.onchange=()=>{ler();p.componentes[Number(el.dataset.cq)].qtd=Math.max(0.01,Number(el.value)||1);draw()});
    modal.querySelectorAll('[data-cr]').forEach(b=>b.onclick=()=>{ler();p.componentes.splice(Number(b.dataset.cr),1);draw()});
    const add=document.getElementById('cpA');
    if(add)add.onclick=()=>{const pid=document.getElementById('cpP').value,q=Number(document.getElementById('cpQ').value)||1;
      if(!pid)return;ler();const ex=p.componentes.find(c=>c.produto===pid);
      if(ex)ex.qtd=Number(ex.qtd)+q;else p.componentes.push({produto:pid,qtd:q});draw()};
    const us=document.getElementById('usaSug');if(us)us.onclick=()=>{ler();p.venda=Math.round(vendaComponentes(p)*100)/100;draw()};
    const pc=document.getElementById('pCan');
    if(pc)pc.onclick=()=>{
      if(ativo(p)){
        const emKits=S.produtos.filter(k=>ehKit(k)&&ativo(k)&&(k.componentes||[]).some(c=>c.produto===p.id));
        if(!confirm('Cancelar este produto? Ele deixa de aparecer em orçamentos e movimentações novas, mas o histórico é mantido.'+
          (emKits.length?' Atenção: ele faz parte de '+emKits.length+' kit(s) ativo(s).':'')))return;
        orig.status='Cancelado';
      }else orig.status='Ativo';
      put('produtos',orig);toast(orig.status==='Ativo'?'Produto reativado':'Produto cancelado');fim();
    };
    document.getElementById('pSv').onclick=()=>{
      ler();
      p.sku=String(p.sku||'').trim();p.nome=String(p.nome||'').trim();
      if(!p.sku||!p.nome){toast('Preencha SKU e descrição');return}
      if(!p.familia||!p.categoria){toast('Escolha a família e a categoria');return}
      if(S.produtos.some(x=>x.id!==p.id&&String(x.sku).toLowerCase()===p.sku.toLowerCase())){toast('Já existe produto com esse SKU');return}
      if(p.tipo==='Kit'){
        const tot=p.componentes.reduce((a,c)=>a+Number(c.qtd||0),0);
        if(!p.componentes.length||tot<2){toast('Um kit precisa reunir mais de um item');return}
        p.custo=Math.round(custoProduto(p)*100)/100;p.minimo=0;p.fornecedor='';
      }else p.componentes=[];
      put('produtos',p);toast('Produto salvo');fim();
    };
  };
  draw();
}
const CENTROS_LUCRO_PADRAO=[['CL01','Residencial'],['CL02','Predial'],['CL03','Corporativo'],['CL04','Revenda de produtos'],['CL05','Contratos de manutenção']];
const CENTROS_CUSTO_PADRAO=[['CC01','Engenharia e projetos'],['CC02','Instalação e campo'],['CC03','Programação e comissionamento'],
  ['CC04','Suporte e pós-venda'],['CC05','Comercial'],['CC06','Marketing'],['CC07','Administrativo']];
function centrosPadrao(){
  const g=(col,c)=>S[col].find(x=>String(x.nome).toLowerCase()===c[1].toLowerCase())||put(col,{codigo:c[0],nome:c[1],status:'Ativa'});
  CENTROS_LUCRO_PADRAO.forEach(c=>g('centros_lucro',c));CENTROS_CUSTO_PADRAO.forEach(c=>g('centros_custo',c));
}
const FAMILIAS_PADRAO=['Automação','Áudio & Vídeo','CFTV','Controle de acesso','Redes e Wi-Fi','Infraestrutura elétrica'];
const CATEGORIAS_PADRAO=['Controladores','Módulos','Sensores','Interfaces','Fontes','Cabos','Câmeras','Gravadores',
  'Leitores e fechaduras','Caixas acústicas','Amplificadores','Racks e acessórios'];
function listaPadrao(){
  const garantir=(col,nome)=>{const ex=S[col].find(x=>String(x.nome).toLowerCase()===nome.toLowerCase());
    return ex||put(col,{nome:nome,status:'Ativa'})};
  FAMILIAS_PADRAO.forEach(n=>garantir('familias',n));
  CATEGORIAS_PADRAO.forEach(n=>garantir('categorias',n));
  let conv=0;
  S.produtos.forEach(p=>{let mud=false;
    if(p.categoria&&!byId('categorias',p.categoria)){p.categoria=garantir('categorias',String(p.categoria)).id;mud=true}
    if(p.familia&&!byId('familias',p.familia)){p.familia=garantir('familias',String(p.familia)).id;mud=true}
    if(mud){put('produtos',p);conv++}});
  return conv;
}

/* ---------- empresas: matriz e filiais ---------- */
const UFS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const TIPOS_DOC=['Cartão CNPJ','Contrato social','Alteração contratual','Inscrição estadual','Inscrição municipal',
  'Alvará de funcionamento','Registro CREA / CFT','Certidão negativa federal','Certidão negativa estadual',
  'Certidão negativa municipal','Certidão FGTS','Certidão trabalhista','Procuração','Outros'];
const soDig=v=>String(v||'').replace(/\D/g,'');
function cnpjDV(b){let s=0,p=b.length-7;for(let i=0;i<b.length;i++){s+=Number(b[i])*p--;if(p<2)p=9}const r=s%11;return r<2?0:11-r}
function cnpjValido(v){const c=soDig(v);if(c.length!==14||/^(\d)\1+$/.test(c))return false;
  const d1=cnpjDV(c.slice(0,12)),d2=cnpjDV(c.slice(0,12)+d1);return d1===Number(c[12])&&d2===Number(c[13])}
function fmtCNPJ(v){const c=soDig(v);return c.length===14?c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):v}
function fmtCPF(v){const c=soDig(v);return c.length===11?c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):v}
function fmtCEP(v){const c=soDig(v);return c.length===8?c.replace(/^(\d{5})(\d{3})$/,'$1-$2'):v}
function diasAte(d){return Math.round((new Date(d+'T12:00:00')-new Date(hoje()+'T12:00:00'))/864e5)}
function badgeValidade(d){if(!d.validade)return '<span class="bg g-gray">sem validade</span>';const n=diasAte(d.validade);
  return n<0?'<span class="bg g-red">Vencido</span>':n<=30?'<span class="bg g-amber">Vence em '+n+'d</span>':'<span class="bg g-green">até '+dBR(d.validade)+'</span>'}
function docsAlerta(){const out=[];S.empresas.filter(ativo).forEach(e=>(e.documentos||[]).forEach(d=>{
  if(d.validade&&diasAte(d.validade)<=30)out.push({empresa:e,doc:d})}));return out}
const nomeEmp=e=>e?(e.nome_fantasia||e.razao_social||'—'):'—';
const tamanho=b=>b>=1048576?(b/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(b/1024))+' KB';
const TIPOS_ARQ={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
async function subirArquivo(file,pasta){
  const ext=(String(file.name).split('.').pop()||'').toLowerCase(), type=TIPOS_ARQ[ext];
  if(!type)throw{code:'unsupported_type'};
  if(file.size>20*1048576)throw{code:'too_large'};
  if(MODE==='firebase'){
    let st;try{st=firebase.storage()}catch(e){throw{code:'sem_storage'}}
    const path=pasta+'/'+uid()+'-'+String(file.name).replace(/[^\w.\-]/g,'_');
    const ref=st.ref(path);await ref.put(file,{contentType:type});
    return{ref:path,url:await ref.getDownloadURL(),tamanho:file.size,contentType:type};
  }
  if(!ASSETS&&typeof claude!=='undefined'){try{ASSETS=await claude.use('assets')}catch(e){ASSETS=null}}
  if(!ASSETS)throw{code:MODE==='local'?'sem_upload':'not_granted'};
  const r=await ASSETS.upload(file,{type:type});
  return{asset:r.id,tamanho:r.sizeBytes,contentType:r.contentType};
}
async function removerArquivo(d){
  try{
    if(d.ref&&MODE==='firebase')await firebase.storage().ref(d.ref).delete();
    else if(d.asset){if(!ASSETS&&typeof claude!=='undefined')ASSETS=await claude.use('assets');if(ASSETS)await ASSETS.delete(d.asset)}
  }catch(e){}
}
const urlDoc=d=>d.url||(d.asset?'/_blob/'+d.asset:'');
const erroUpload=e=>({unsupported_type:'Envie PDF, PNG, JPG ou WEBP. Documentos do Word precisam ser salvos em PDF.',
  too_large:'Arquivo acima de 20 MB.',quota_or_state:'O espaço de armazenamento de arquivos está cheio.',
  not_granted:'Seu acesso a este sistema não permite enviar arquivos.',rate_limited:'Muitos envios seguidos — aguarde alguns segundos.',
  sem_upload:'Envio de arquivos disponível no sistema publicado (claude.ai ou Firebase).',
  sem_storage:'Ative o Storage no console do Firebase para enviar documentos.'}[e&&e.code]||'Não foi possível enviar o arquivo.');

function renderAnexos(el,cfg){
  if(!el)return;
  const L=cfg.lista()||[];
  el.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'+
    '<input type="file" class="axF" accept=".pdf,.png,.jpg,.jpeg,.webp" style="flex:1;min-width:180px">'+
    '<button class="btn sm axU">Anexar</button><span class="note axM" style="margin:0"></span></div>'+
    tbl([{l:'Arquivo',s:1,f:d=>esc(d.nome)},{l:'Tamanho',f:d=>tamanho(d.tamanho||0)},{l:'Enviado',f:d=>dBR(d.enviado_em)},
      {l:'',n:1,f:d=>'<a class="btn sec sm" href="'+esc(urlDoc(d))+'" target="_blank" rel="noopener" style="text-decoration:none">Abrir</a> '+
        '<button class="btn dgr sm" data-axr="'+d.id+'">×</button>'}],L,{empty:cfg.vazio||'Nenhum arquivo anexado.'});
  const q=c=>el.querySelector(c), up=q('.axU');if(!up)return;
  up.onclick=async()=>{const f=q('.axF').files[0],m=q('.axM');if(!f){m.textContent='Escolha um arquivo.';return}
    up.disabled=true;m.textContent='Enviando…';
    try{const r=await subirArquivo(f,cfg.pasta);const arr=(cfg.lista()||[]).slice();
      arr.push(Object.assign({id:uid(),nome:f.name,enviado_em:hoje()},r));cfg.salvar(arr);toast('Arquivo anexado');cfg.depois()}
    catch(e){up.disabled=false;m.textContent=erroUpload(e)}};
  el.querySelectorAll('[data-axr]').forEach(b=>b.onclick=async()=>{const arr=cfg.lista()||[],d=arr.find(x=>x.id===b.dataset.axr);
    if(!d||!confirm('Remover "'+d.nome+'"? O arquivo será apagado.'))return;
    await removerArquivo(d);cfg.salvar(arr.filter(x=>x.id!==d.id));toast('Arquivo removido');cfg.depois()});
}
let empTab='dados';
function editarEmpresa(id,after,aba){
  const orig=id?byId('empresas',id):null;
  const e=orig?JSON.parse(JSON.stringify(orig)):{tipo:S.empresas.some(x=>x.tipo==='Matriz'&&ativo(x))?'Filial':'Matriz',
    status:'Ativa',documentos:[],uf:'DF',regime:'Simples Nacional'};
  empTab=aba||'dados';
  const fim=()=>{closeM();after?after():render()};
  const ler=()=>modal.querySelectorAll('[data-k]').forEach(el=>{if(el.dataset.k!=='id')e[el.dataset.k]=el.value});
  const campos=()=>({
    dados:[{t:'secao',l:'Identificação'},
      {k:'tipo',l:'Tipo',t:'select',opts:['Matriz','Filial'],req:1},
      e.tipo==='Filial'?{k:'matriz',l:'Matriz',t:'ref',col:'empresas',lab:'razao_social',req:1,
        filtro:x=>x.tipo==='Matriz'&&ativo(x)&&x.id!==e.id}:{t:'vazio'},
      {k:'razao_social',l:'Razão social',req:1,full:1},{k:'nome_fantasia',l:'Nome fantasia'},
      {k:'cnpj',l:'CNPJ',req:1},{k:'abertura',l:'Data de abertura',t:'date'},
      {k:'ie',l:'Inscrição estadual'},{k:'im',l:'Inscrição municipal'},
      {t:'secao',l:'Tributação e atividade'},
      {k:'regime',l:'Regime tributário',t:'select',opts:['Simples Nacional','MEI','Lucro Presumido','Lucro Real']},
      {k:'porte',l:'Porte',t:'select',opts:['MEI','ME','EPP','Demais']},
      {k:'cnae',l:'CNAE principal'},{k:'cnaes_sec',l:'CNAEs secundários'},
      {k:'natureza',l:'Natureza jurídica',full:1}],
    end:[{t:'secao',l:'Endereço'},
      {k:'cep',l:'CEP'},{k:'uf',l:'UF',t:'select',opts:UFS},
      {k:'logradouro',l:'Logradouro',full:1},{k:'numero',l:'Número'},{k:'complemento',l:'Complemento'},
      {k:'bairro',l:'Bairro'},{k:'cidade',l:'Cidade'},
      {t:'secao',l:'Contato'},
      {k:'telefone',l:'Telefone'},{k:'whatsapp',l:'WhatsApp'},{k:'email',l:'E-mail'},
      {k:'email_fin',l:'E-mail financeiro / NF-e'},{k:'site',l:'Site',full:1}],
    resp:[{t:'secao',l:'Responsável legal'},
      {k:'resp_nome',l:'Nome'},{k:'resp_cpf',l:'CPF'},{k:'resp_cargo',l:'Cargo'},{k:'resp_email',l:'E-mail'},
      {t:'secao',l:'Dados bancários'},
      {k:'banco',l:'Banco'},{k:'agencia',l:'Agência'},{k:'conta',l:'Conta'},
      {k:'tipo_conta',l:'Tipo de conta',t:'select',opts:['Corrente','Poupança','Pagamento']},{k:'pix',l:'Chave PIX',full:1},
      {k:'obs',l:'Observações',t:'textarea'}]});
  const draw=()=>{
    const docs=(orig&&orig.documentos)||[];
    const venc=docs.filter(d=>d.validade&&diasAte(d.validade)<0).length;
    let h='<div class="tabs">'+[['dados','Dados'],['end','Endereço e contato'],['resp','Responsável e banco'],
      ['docs','Documentos ('+docs.length+')'+(venc?' ⚠':'')]].map(t=>'<button class="tab'+(empTab===t[0]?' on':'')+'" data-et="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>';
    if(empTab!=='docs'){
      h+=formHtml(campos()[empTab],e);
      if(empTab==='dados'&&e.cnpj&&!cnpjValido(e.cnpj))h+='<div class="note" style="color:var(--red)">CNPJ inválido — confira os dígitos.</div>';
    }else if(!orig){
      h+='<div class="empty">Salve a empresa primeiro. Em seguida esta aba libera o envio de documentos.</div>';
    }else{
      h+='<div class="card" style="margin-bottom:12px"><div class="cbody"><div class="frow">'+
        '<label class="f"><span>Tipo de documento</span><select id="dTp">'+TIPOS_DOC.map(t=>'<option>'+t+'</option>').join('')+'</select></label>'+
        '<label class="f"><span>Validade (se houver)</span><input type="date" id="dVl"></label></div>'+
        '<label class="f"><span>Descrição</span><input type="text" id="dDs" placeholder="Ex.: 3ª alteração contratual, certidão emitida em…"></label>'+
        '<label class="f"><span>Arquivo (PDF, PNG, JPG ou WEBP · até 20 MB)</span><input type="file" id="dFl" accept=".pdf,.png,.jpg,.jpeg,.webp"></label>'+
        '<button class="btn sm" id="dUp">Enviar documento</button> <span class="note" id="dMsg"></span></div></div>'+
        tbl([{l:'Documento',s:1,f:d=>esc(d.tipo)+(d.descricao?'<div style="font-size:11px;color:var(--faint)">'+esc(d.descricao)+'</div>':'')},
          {l:'Arquivo',f:d=>'<span style="font-size:12px">'+esc(d.nome)+'</span><div style="font-size:11px;color:var(--faint)">'+tamanho(d.tamanho||0)+'</div>'},
          {l:'Validade',f:badgeValidade},{l:'Enviado',f:d=>dBR(d.enviado_em)},
          {l:'',n:1,f:d=>'<a class="btn sec sm" href="'+esc(urlDoc(d))+'" target="_blank" rel="noopener" style="text-decoration:none">Abrir</a> '+
            '<button class="btn dgr sm" data-rd="'+d.id+'">×</button>'}],
          docs.slice().sort((a,b)=>String(b.enviado_em).localeCompare(String(a.enviado_em))),{empty:'Nenhum documento anexado ainda.'});
    }
    const trav=orig&&!ativo(orig);
    modal.className='wide';
    modal.innerHTML='<div class="mhead"><h3>'+(orig?esc(nomeEmp(orig)):'Nova empresa')+
      (orig?' <span class="bg '+(orig.tipo==='Matriz'?'g-brand':'g-accent')+'">'+orig.tipo+'</span>':'')+
      (trav?' <span class="bg g-red">cancelada</span>':'')+'</h3><button class="x" onclick="closeM()">&times;</button></div>'+
      '<div class="mbody">'+h+'</div><div class="mfoot">'+
      (orig?'<button class="btn '+(ativo(orig)?'dgr':'sec')+' sm" id="eCa" style="margin-right:auto">'+(ativo(orig)?'Cancelar empresa':'Reativar empresa')+'</button>':'')+
      '<button class="btn sec" onclick="closeM()">Fechar</button><button class="btn" id="eSv">Salvar</button></div>';
    ovl.classList.add('on');
    modal.querySelectorAll('[data-et]').forEach(b=>b.onclick=()=>{if(empTab!=='docs')ler();empTab=b.dataset.et;draw()});
    const tp=modal.querySelector('[data-k="tipo"]');if(tp)tp.onchange=()=>{ler();if(e.tipo==='Matriz')e.matriz='';draw()};
    const cn=modal.querySelector('[data-k="cnpj"]');if(cn)cn.onblur=()=>{ler();e.cnpj=fmtCNPJ(e.cnpj);draw()};
    const cp=modal.querySelector('[data-k="cep"]');if(cp)cp.onblur=()=>{cp.value=fmtCEP(cp.value)};
    const cf=modal.querySelector('[data-k="resp_cpf"]');if(cf)cf.onblur=()=>{cf.value=fmtCPF(cf.value)};
    const up=document.getElementById('dUp');
    if(up)up.onclick=async()=>{
      const f=document.getElementById('dFl').files[0], msg=document.getElementById('dMsg');
      if(!f){msg.textContent='Escolha um arquivo.';return}
      up.disabled=true;msg.textContent='Enviando…';
      try{
        const r=await subirArquivo(f,'documentos/'+orig.id);
        orig.documentos=orig.documentos||[];
        orig.documentos.push(Object.assign({id:uid(),tipo:document.getElementById('dTp').value,
          descricao:document.getElementById('dDs').value.trim(),validade:document.getElementById('dVl').value,
          nome:f.name,enviado_em:hoje()},r));
        put('empresas',orig);e.documentos=orig.documentos.slice();toast('Documento anexado');draw();
      }catch(err){up.disabled=false;msg.textContent=erroUpload(err)}
    };
    modal.querySelectorAll('[data-rd]').forEach(b=>b.onclick=async()=>{
      const d=orig.documentos.find(x=>x.id===b.dataset.rd);if(!d||!confirm('Remover "'+d.tipo+' · '+d.nome+'"? O arquivo será apagado.'))return;
      await removerArquivo(d);orig.documentos=orig.documentos.filter(x=>x.id!==d.id);
      put('empresas',orig);e.documentos=orig.documentos.slice();toast('Documento removido');draw();
    });
    const ca=document.getElementById('eCa');
    if(ca)ca.onclick=()=>{
      if(ativo(orig)){
        const fil=S.empresas.filter(x=>x.matriz===orig.id&&ativo(x)).length;
        if(!confirm('Cancelar '+nomeEmp(orig)+'?'+(fil?' Ela tem '+fil+' filial(is) ativa(s), que continuarão ativas.':'')+' Os dados e documentos são mantidos.'))return;
        orig.status='Cancelada';
      }else orig.status='Ativa';
      put('empresas',orig);toast(orig.status==='Ativa'?'Empresa reativada':'Empresa cancelada');fim();
    };
    document.getElementById('eSv').onclick=()=>{
      if(empTab!=='docs')ler();
      e.razao_social=String(e.razao_social||'').trim();e.cnpj=fmtCNPJ(e.cnpj);
      if(!e.razao_social){empTab='dados';draw();toast('Informe a razão social');return}
      if(!cnpjValido(e.cnpj)){empTab='dados';draw();toast('CNPJ inválido');return}
      if(S.empresas.some(x=>x.id!==e.id&&soDig(x.cnpj)===soDig(e.cnpj))){toast('Já existe empresa com esse CNPJ');return}
      if(e.tipo==='Filial'&&!e.matriz){empTab='dados';draw();toast('Escolha a matriz desta filial');return}
      const c=soDig(e.cnpj),av=[];
      if(e.tipo==='Matriz'&&c.slice(8,12)!=='0001')av.push('CNPJ de matriz normalmente termina em /0001.');
      if(e.tipo==='Filial'){const m=byId('empresas',e.matriz);
        if(m&&soDig(m.cnpj).slice(0,8)!==c.slice(0,8))av.push('A raiz do CNPJ (8 primeiros dígitos) é diferente da matriz.');
        if(c.slice(8,12)==='0001')av.push('CNPJ /0001 normalmente é de matriz.')}
      if(av.length&&!confirm(av.join('\n')+'\n\nSalvar mesmo assim?'))return;
      if(orig)e.documentos=orig.documentos||[];
      const novo=!orig, rec=put('empresas',e);
      if(novo){toast('Empresa salva — agora anexe os documentos');editarEmpresa(rec.id,after,'docs')}else{toast('Empresa salva');fim()}
    };
  };
  draw();
}

/* ---------- cadastros ---------- */
let cadTab='produtos';
R.cadastros=v=>{
  const abas=[['empresas','Empresas'],['centros_lucro','Centros de lucro'],['centros_custo','Centros de custo'],['produtos','Produtos'],['familias','Famílias'],['categorias','Categorias'],['servicos','Serviços'],
    ['colaboradores','Equipe'],['locais','Locais de estoque'],['fornecedores','Fornecedores']];
  const rotNovo={empresas:'+ Nova empresa',centros_lucro:'+ Novo centro de lucro',centros_custo:'+ Novo centro de custo',produtos:'+ Novo produto',familias:'+ Nova família',categorias:'+ Nova categoria',servicos:'+ Novo serviço',
    colaboradores:'+ Novo colaborador',locais:'+ Novo local',fornecedores:'+ Novo fornecedor'};
  v.innerHTML='<div class="tabs">'+abas.map(a=>'<button class="tab'+(cadTab===a[0]?' on':'')+'" data-tab="'+a[0]+'">'+a[1]+'</button>').join('')+'</div>'+
    '<div class="toolbar"><button class="btn" id="nv">'+rotNovo[cadTab]+'</button>'+
    (cadTab==='produtos'?'<select id="fTp"><option value="">Simples e kits</option><option>Simples</option><option>Kit</option></select>'+
      '<select id="fFm"><option value="">Todas as famílias</option>'+S.familias.map(f=>'<option value="'+f.id+'">'+esc(f.nome)+'</option>').join('')+'</select>'+
      '<input type="text" id="fBu" placeholder="Buscar SKU ou descrição…">':'')+
    ((['familias','categorias','centros_lucro','centros_custo'].includes(cadTab))?'<button class="btn sec sm" id="padrao">Carregar lista padrão</button>':'')+
    ((['empresas','centros_lucro','centros_custo','produtos','familias','categorias'].includes(cadTab))?'<label style="font-size:12.5px;color:var(--dim);display:flex;gap:6px;align-items:center">'+
      '<input type="checkbox" id="fCa"'+(verCancelados?' checked':'')+'> mostrar cancelados</label>':'')+'</div>'+
    '<div class="card"><div class="cbody" id="lst"></div></div>'+
    '<div class="card"><div class="chead"><h2>Dados</h2></div><div class="cbody">'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sec sm" id="demo">Carregar dados de exemplo</button>'+
    '<button class="btn sec sm" id="exp">Exportar backup</button><button class="btn sec sm" id="imp">Importar backup</button>'+
    '<button class="btn dgr sm" id="zap">Apagar tudo</button><input type="file" id="fimp" accept=".json" style="display:none"></div>'+
    '<div class="note">Os dados ficam salvos automaticamente. Use Exportar e Importar backup para levar os dados daqui para o Firebase. '+
    '"Apagar tudo" remove todos os registros deste sistema.</div></div></div>';
  v.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{cadTab=b.dataset.tab;render()});
  document.getElementById('nv').onclick=()=>editRec(cadTab,null);
  const pd=document.getElementById('padrao');
  if(pd)pd.onclick=()=>{if(cadTab.startsWith('centros_')){centrosPadrao();toast('Centros padrão carregados');render();return}
    const n=listaPadrao();toast('Famílias e categorias padrão carregadas'+(n?' · '+n+' produto(s) convertidos':''));render()};
  const fc=document.getElementById('fCa');if(fc)fc.onchange=()=>{verCancelados=fc.checked;render()};
  document.getElementById('demo').onclick=()=>{if(confirm('Carregar um conjunto de dados de exemplo?'))seedDemo()};
  document.getElementById('exp').onclick=()=>{
    const d={};COLS.forEach(c=>d[c]=S[c]);
    baixarArquivo('ative-one-backup-'+hoje()+'.json',JSON.stringify(d,null,1));
  };
  document.getElementById('imp').onclick=()=>document.getElementById('fimp').click();
  document.getElementById('fimp').onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    f.text().then(t=>{
      let d;try{d=JSON.parse(t)}catch(x){toast('Arquivo inválido');return}
      const cs=COLS.filter(c=>Array.isArray(d[c]));
      if(!cs.length){toast('Nenhum dado do Ative One nesse arquivo');return}
      const n=cs.reduce((a,c)=>a+d[c].length,0);
      if(!confirm('Substituir os dados atuais por '+n+' registros do backup?'))return;
      cs.forEach(c=>{S[c]=d[c];save(c)});toast(n+' registros importados');render();
    });
  };
  document.getElementById('zap').onclick=()=>{if(confirm('Apagar TODOS os registros? Não há como desfazer.')){
    COLS.forEach(c=>{S[c]=[];save(c)});toast('Base zerada');render()}};
  const el=document.getElementById('lst');
  const C={
    empresas:[{l:'Tipo',f:r=>'<span class="bg '+(r.tipo==='Matriz'?'g-brand':'g-accent')+'">'+esc(r.tipo)+'</span>'},
      {l:'Empresa',s:1,f:r=>(r.tipo==='Filial'?'<span style="color:var(--faint)">└ </span>':'')+esc(r.razao_social)+
        (r.nome_fantasia?'<div style="font-size:11px;color:var(--faint)">'+esc(r.nome_fantasia)+'</div>':'')},
      {l:'CNPJ',f:r=>esc(fmtCNPJ(r.cnpj))},{l:'IE',k:'ie'},{l:'IM',k:'im'},
      {l:'Cidade / UF',f:r=>esc([r.cidade,r.uf].filter(Boolean).join(' / ')||'—')},
      {l:'Documentos',n:1,f:r=>{const d=r.documentos||[],v=d.filter(x=>x.validade&&diasAte(x.validade)<0).length,
        q=d.filter(x=>x.validade&&diasAte(x.validade)>=0&&diasAte(x.validade)<=30).length;
        return d.length+(v?' <span class="bg g-red">'+v+' vencido(s)</span>':'')+(q?' <span class="bg g-amber">'+q+' a vencer</span>':'')}},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativa':'Cancelada')+'</span>'}],
    produtos:[{l:'Tipo',f:r=>'<span class="bg '+(ehKit(r)?'g-purple':'g-gray')+'">'+tipoProd(r)+'</span>'},
      {l:'SKU',k:'sku',s:1},{l:'Descrição',f:r=>esc(r.nome)+(ehKit(r)?'<div style="font-size:11px;color:var(--faint)">'+esc(descComp(r))+'</div>':'')},
      {l:'Família',f:r=>esc(nomeClass('familias',r.familia))},{l:'Categoria',f:r=>esc(nomeClass('categorias',r.categoria))},
      {l:'Custo',n:1,f:r=>money(custoProduto(r))},{l:'Venda',n:1,f:r=>money(r.venda)},
      {l:'Margem',n:1,f:r=>{const c=custoProduto(r);return Number(r.venda)?pct((r.venda-c)/r.venda*100):'—'}},
      {l:'Estoque',n:1,f:r=>ehKit(r)?'monta '+kitMontavel(r).n:num(saldoProd(r.id),2)},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativo':'Cancelado')+'</span>'}],
    centros_lucro:[{l:'Código',k:'codigo'},{l:'Centro de lucro',k:'nome',s:1},{l:'Descrição',k:'descricao'},
      {l:'Projetos',n:1,f:r=>S.obras.filter(o=>centroDe('lucro','obras',o)===r.id).length},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativo':'Cancelado')+'</span>'}],
    centros_custo:[{l:'Código',k:'codigo'},{l:'Centro de custo',k:'nome',s:1},{l:'Descrição',k:'descricao'},
      {l:'Projetos',n:1,f:r=>S.obras.filter(o=>centroDe('custo','obras',o)===r.id).length},
      {l:'Lançamentos',n:1,f:r=>S.financeiro.filter(l=>centroDe('custo','financeiro',l)===r.id).length},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativo':'Cancelado')+'</span>'}],
    familias:[{l:'Família',k:'nome',s:1},{l:'Descrição',k:'descricao'},
      {l:'Produtos',n:1,f:r=>S.produtos.filter(p=>p.familia===r.id).length},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativa':'Cancelada')+'</span>'}],
    categorias:[{l:'Categoria',k:'nome',s:1},{l:'Descrição',k:'descricao'},
      {l:'Produtos',n:1,f:r=>S.produtos.filter(p=>p.categoria===r.id).length},
      {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-red')+'">'+(ativo(r)?'Ativa':'Cancelada')+'</span>'}],
    servicos:[{l:'Descrição',k:'nome',s:1},{l:'Unidade',k:'unidade'},{l:'Custo',n:1,f:r=>money(r.custo)},
      {l:'Venda',n:1,f:r=>money(r.venda)},{l:'Margem',n:1,f:r=>Number(r.venda)?pct((r.venda-r.custo)/r.venda*100):'—'}],
    colaboradores:[{l:'Nome',k:'nome',s:1},{l:'Função',k:'funcao'},{l:'Custo/hora',n:1,f:r=>money(r.custo_hora)},
      {l:'Horas/semana',n:1,k:'capacidade'},{l:'Horas lançadas',n:1,f:r=>num(S.apontamentos.filter(a=>a.colaborador===r.id).reduce((a,x)=>a+Number(x.horas||0),0),1)}],
    locais:[{l:'Local',k:'nome',s:1},{l:'Tipo',f:r=>'<span class="bg g-accent">'+esc(r.tipo)+'</span>'},
      {l:'Responsável',f:r=>esc(nm('colaboradores',r.responsavel))},
      {l:'Itens em posse',n:1,f:r=>S.produtos.filter(p=>Math.abs(saldoProdLocal(p.id,r.id))>0.001).length}],
    fornecedores:[{l:'Fornecedor',k:'nome',s:1},{l:'CNPJ',k:'cnpj'},{l:'Categoria',k:'categoria'},
      {l:'Contato',k:'contato'},{l:'Prazo',n:1,f:r=>r.prazo?r.prazo+'d':'—'}]
  };
  const desenhar=()=>{
    let rows=S[cadTab].slice();
    if(['empresas','centros_lucro','centros_custo','produtos','familias','categorias'].includes(cadTab)){
      if(!verCancelados)rows=rows.filter(ativo);
      rows.sort((a,b)=>(ativo(b)-ativo(a))||String(a.nome).localeCompare(String(b.nome)));
    }
    if(cadTab==='empresas'){
      const mats=rows.filter(x=>x.tipo==='Matriz').sort((a,b)=>String(a.razao_social).localeCompare(String(b.razao_social)));
      const ord=[];mats.forEach(m=>{ord.push(m);rows.filter(f=>f.tipo==='Filial'&&f.matriz===m.id).forEach(f=>ord.push(f))});
      rows.filter(x=>!ord.includes(x)).forEach(x=>ord.push(x));rows=ord;
    }
    if(cadTab==='produtos'){
      const tp=document.getElementById('fTp').value,fm=document.getElementById('fFm').value,
        q=(document.getElementById('fBu').value||'').toLowerCase();
      rows=rows.filter(p=>(!tp||tipoProd(p)===tp)&&(!fm||p.familia===fm)&&
        (!q||String(p.sku||'').toLowerCase().includes(q)||String(p.nome||'').toLowerCase().includes(q)));
    }
    el.innerHTML=tbl(C[cadTab],rows,{acts:1,empty:cadTab.startsWith('centros_')?'Nenhum centro cadastrado. Use "Carregar lista padrão" ou cadastre os seus.':cadTab==='empresas'?'Cadastre a matriz e depois as filiais.':cadTab==='familias'||cadTab==='categorias'?
      'Nenhuma cadastrada. Use "Carregar lista padrão" ou cadastre a sua.':'Nada cadastrado ainda.'});
    wireTable(el,cadTab);
  };
  if(cadTab==='produtos')['fTp','fFm'].forEach(i=>document.getElementById(i).onchange=desenhar);
  if(cadTab==='produtos')document.getElementById('fBu').oninput=desenhar;
  desenhar();
};
let verCancelados=false;

/* ---------- dados de exemplo ---------- */
function seedDemo(){
  const eq=[['Marcos Lima','Coordenador técnico',95,40],['Débora Cruz','Programadora',88,40],
    ['Rafael Teles','Instalador',62,44],['Jonas Pires','Instalador auxiliar',48,44]]
    .map(c=>put('colaboradores',{nome:c[0],funcao:c[1],custo_hora:c[2],capacidade:c[3]}));
  const loc=[put('locais',{nome:'Almoxarifado central',tipo:'Almoxarifado'}),
    put('locais',{nome:'Van · Marcos',tipo:'Técnico',responsavel:eq[0].id}),
    put('locais',{nome:'Van · Rafael',tipo:'Técnico',responsavel:eq[2].id})];
  const forn=[put('fornecedores',{nome:'Domotec Distribuidora',cnpj:'11222333000144',categoria:'Automação',prazo:30}),
    put('fornecedores',{nome:'Cabos & Cia',cnpj:'55666777000188',categoria:'Elétrica',prazo:21})];
  const cnpjCom=b=>{const d1=cnpjDV(b);return fmtCNPJ(b+d1+cnpjDV(b+d1))};
  const mz=put('empresas',{tipo:'Matriz',razao_social:'Ative One Automação Ltda (exemplo)',nome_fantasia:'Ative One',
    cnpj:cnpjCom('112223330001'),ie:'07.123.456/001-89',im:'123456',abertura:'2024-03-12',regime:'Simples Nacional',porte:'ME',
    cnae:'4321-5/00 Instalação e manutenção elétrica',cnaes_sec:'4329-1/04; 7112-0/00',natureza:'Sociedade Empresária Limitada',
    cep:'70000-000',uf:'DF',logradouro:'SIA Trecho 3',numero:'100',bairro:'SIA',cidade:'Brasília',telefone:'(61) 3000-0000',
    email:'contato@exemplo.com.br',resp_nome:'Sócio administrador',resp_cargo:'Administrador',status:'Ativa',documentos:[]});
  const fl=put('empresas',{tipo:'Filial',matriz:mz.id,razao_social:'Ative One Automação Ltda (exemplo)',nome_fantasia:'Ative One Goiânia',
    cnpj:cnpjCom('112223330002'),ie:'10.987.654-3',im:'654321',regime:'Simples Nacional',porte:'ME',
    uf:'GO',logradouro:'Av. T-63',numero:'500',bairro:'Setor Bueno',cidade:'Goiânia',status:'Ativa',documentos:[]});
  loc.forEach(l=>{l.empresa=mz.id;put('locais',l)});
  centrosPadrao();
  const cL=n=>S.centros_lucro.find(x=>x.nome===n).id, cC=n=>S.centros_custo.find(x=>x.nome===n).id;
  const locGo=put('locais',{nome:'Almoxarifado Goiânia',tipo:'Almoxarifado',empresa:fl.id});
  listaPadrao();
  const idF=n=>S.familias.find(x=>x.nome===n).id, idC=n=>S.categorias.find(x=>x.nome===n).id;
  const prods=[['AUT-KNX-CTL','Central de automação KNX','Controladores',9200,11500,3,'Automação','un'],
    ['AUT-DIM-08','Módulo dimmer 8 canais','Módulos',1480,1850,15,'Automação','un'],
    ['AUT-REL-12','Módulo relé 12 canais','Módulos',1320,1690,8,'Automação','un'],
    ['AUT-TCH-07','Touch panel 7 polegadas','Interfaces',2100,2690,6,'Automação','un'],
    ['AUT-SEN-360','Sensor de presença 360°','Sensores',310,420,20,'Automação','un'],
    ['AUT-PWR-24','Fonte 24V 5A DIN','Fontes',430,590,10,'Infraestrutura elétrica','un'],
    ['AUT-CAB-KNX','Cabo KNX 2x2x0,8 · rolo 100m','Cabos',680,890,6,'Infraestrutura elétrica','rolo']]
    .map(p=>put('produtos',{tipo:'Simples',status:'Ativo',sku:p[0],nome:p[1],familia:idF(p[6]),categoria:idC(p[2]),
      unidade:p[7],custo:p[3],venda:p[4],minimo:p[5],fornecedor:forn[0].id}));
  const k1={tipo:'Kit',status:'Ativo',sku:'KIT-ILUM-SALA',nome:'Kit cena de iluminação · sala',familia:idF('Automação'),
    categoria:idC('Módulos'),unidade:'kit',venda:3190,minimo:0,
    componentes:[{produto:prods[1].id,qtd:1},{produto:prods[4].id,qtd:2},{produto:prods[5].id,qtd:1}]};
  k1.custo=custoProduto(k1);put('produtos',k1);
  const k2={tipo:'Kit',status:'Ativo',sku:'KIT-SALA-REUNIAO',nome:'Kit sala de reunião inteligente',familia:idF('Automação'),
    categoria:idC('Interfaces'),unidade:'kit',venda:4990,minimo:0,
    componentes:[{produto:prods[2].id,qtd:1},{produto:prods[3].id,qtd:1},{produto:prods[4].id,qtd:1},{produto:prods[5].id,qtd:1}]};
  k2.custo=custoProduto(k2);put('produtos',k2);
  prods.forEach((p,i)=>put('estoque',{produto:p.id,local:loc[0].id,qtd:[7,42,11,16,58,9,14][i],tipo:'Entrada',
    data:addDias(hoje(),-40),custo:p.custo,doc:'Saldo inicial'}));
  put('estoque',{produto:prods[1].id,local:loc[1].id,qtd:6,tipo:'Transferência',data:addDias(hoje(),-6),custo:prods[1].custo,doc:'← Almoxarifado central'});
  put('estoque',{produto:prods[4].id,local:loc[2].id,qtd:12,tipo:'Transferência',data:addDias(hoje(),-4),custo:prods[4].custo,doc:'← Almoxarifado central'});
  [['Projeto executivo e diagramas','verba',4800,11000],['Instalação e cabeamento','hora',78,165],
   ['Programação e cenas','hora',95,210],['Comissionamento e treinamento','verba',1600,3800],
   ['Visita técnica de levantamento','verba',280,650]].forEach(s=>
    put('servicos',{nome:s[0],unidade:s[1],custo:s[2],venda:s[3]}));
  const cli=[['Família Andrade','Residencial','Brasília','Ana Andrade'],
    ['Construtora Vértice','Predial','Brasília','Paulo Renner'],
    ['Clínica Vitalis','Corporativo','Brasília','Dra. Helena'],
    ['Cond. Alphaville','Predial','Brasília','Síndico Jorge'],
    ['Escritório Lumina','Corporativo','Brasília','Camila Reis']]
    .map(c=>put('clientes',{nome:c[0],vertical:c[1],cidade:c[2],contato:c[3],telefone:'(61) 9xxxx-xxxx'}));
  const camp=put('campanhas',{nome:'Casa conectada · Lago Sul',objetivo:'Geração de leads',vertical:'Residencial',
    canal:'Instagram',orcamento:9000,investido:5400,leads:39,inicio:addDias(hoje(),-25),fim:addDias(hoje(),20),status:'No ar'});
  put('campanhas',{nome:'Parceria com arquitetos',objetivo:'Indicação qualificada',vertical:'Residencial',
    canal:'Indicação arquiteto',orcamento:6200,investido:6200,leads:28,inicio:addDias(hoje(),-60),fim:addDias(hoje(),60),status:'No ar'});
  [['Família Andrade',0,'Casa 320m² — iluminação, clima e áudio','Residencial','Negociação',148000,'Indicação arquiteto'],
   ['Construtora Vértice',1,'3 torres — automação de áreas comuns','Predial','Proposta',410000,'Construtora parceira'],
   ['Clínica Vitalis',2,'Controle de acesso e climatização','Corporativo','Visita técnica',76000,'Google'],
   ['Escritório Lumina',4,'Retrofit sala de reunião','Corporativo','Ganho',54700,'Instagram'],
   ['Cond. Alphaville',3,'Portaria automatizada','Predial','Ganho',126900,'Indicação arquiteto']]
   .forEach(o=>put('oportunidades',{cliente:cli[o[1]].id,titulo:o[2],vertical:o[3],estagio:o[4],valor:o[5],
     canal:o[6],campanha:o[6]==='Instagram'?camp.id:'',responsavel:eq[0].id,data_prevista:addDias(hoje(),20)}));
  const ob1=put('obras',{codigo:'PRJ-0001',cliente:cli[4].id,titulo:'Retrofit sala de reunião',vertical:'Corporativo',
    valor:54700,orcado_material:21000,orcado_mo:12800,inicio:addDias(hoje(),-50),fim_prev:addDias(hoje(),-5),
    status:'Concluída',fim:addDias(hoje(),-5),
    etapas:[{nome:'Projeto executivo',pct:15,status:'Concluída'},{nome:'Infra e cabeamento',pct:30,status:'Concluída'},
      {nome:'Instalação de módulos',pct:25,status:'Concluída'},{nome:'Programação',pct:15,status:'Concluída'},
      {nome:'Comissionamento e entrega',pct:15,status:'Concluída'}]});
  const ob2=put('obras',{codigo:'PRJ-0002',cliente:cli[3].id,titulo:'Portaria automatizada',vertical:'Predial',
    valor:126900,orcado_material:58000,orcado_mo:26400,inicio:addDias(hoje(),-20),fim_prev:addDias(hoje(),25),
    status:'Em execução',
    etapas:[{nome:'Projeto executivo',pct:15,status:'Concluída'},{nome:'Compra de material',pct:0,status:'Concluída'},
      {nome:'Infra e cabeamento',pct:30,status:'Em execução'},{nome:'Instalação de módulos',pct:25,status:'Pendente'},
      {nome:'Programação',pct:15,status:'Pendente'},{nome:'Comissionamento e entrega',pct:15,status:'Pendente'}]});
  [[ob1,eq[0],38,'Programação'],[ob1,eq[2],96,'Instalação de módulos'],[ob1,eq[1],44,'Programação'],
   [ob2,eq[0],22,'Infra e cabeamento'],[ob2,eq[3],78,'Infra e cabeamento']].forEach(a=>
    put('apontamentos',{obra:a[0].id,colaborador:a[1].id,horas:a[2],etapa:a[3],data:addDias(hoje(),-12)}));
  put('estoque',{produto:prods[0].id,local:loc[0].id,qtd:-1,tipo:'Saída',data:addDias(hoje(),-30),obra:ob1.id,custo:prods[0].custo,doc:'Consumo OB-0001'});
  put('estoque',{produto:prods[3].id,local:loc[0].id,qtd:-2,tipo:'Saída',data:addDias(hoje(),-28),obra:ob1.id,custo:prods[3].custo,doc:'Consumo OB-0001'});
  put('estoque',{produto:prods[2].id,local:loc[0].id,qtd:-4,tipo:'Saída',data:addDias(hoje(),-10),obra:ob2.id,custo:prods[2].custo,doc:'Consumo OB-0002'});
  put('financeiro',{tipo:'Receber',descricao:'OB-0001 · parcela final',categoria:'Serviço',valor:54700,
    vencimento:addDias(hoje(),-4),cliente:cli[4].id,obra:ob1.id,status:'Recebido',pagamento:addDias(hoje(),-4)});
  [[40,-10,'Recebido'],[35,12,'Pendente'],[25,45,'Pendente']].forEach((p,i)=>
    put('financeiro',{tipo:'Receber',descricao:'OB-0002 · parcela '+(i+1)+'/3',categoria:'Serviço',
      valor:126900*p[0]/100,vencimento:addDias(hoje(),p[1]),cliente:cli[3].id,obra:ob2.id,status:p[2]}));
  put('financeiro',{tipo:'Pagar',descricao:'NF-e 8841 · Domotec',categoria:'Material',valor:22480,
    vencimento:addDias(hoje(),8),fornecedor:forn[0].id,obra:ob2.id,status:'Pendente'});
  put('financeiro',{tipo:'Pagar',descricao:'Anúncios Meta · setembro',categoria:'Marketing',valor:5400,
    vencimento:addDias(hoje(),3),status:'Pendente'});
  put('financeiro',{tipo:'Pagar',descricao:'Aluguel do galpão',categoria:'Administrativo',valor:6800,
    vencimento:addDias(hoje(),-2),status:'Pendente'});
  const ctr=put('contratos',{cliente:cli[4].id,obra:ob1.id,plano:'Corporativo · remoto + 1 visita',valor:1100,
    inicio:addDias(hoje(),-5),fim:addDias(hoje(),360),visitas_mes:1,sla_horas:8,status:'Ativo'});
  put('os',{cliente:cli[4].id,obra:ob1.id,tipo:'Garantia',descricao:'Touch panel da sala não responde',
    tecnico:eq[0].id,data:hoje(),hora:'09:00',duracao:3,prioridade:'Alta',status:'Agendada',contrato:ctr.id});
  put('os',{cliente:cli[3].id,obra:ob2.id,tipo:'Instalação',descricao:'Instalar módulos da portaria',
    tecnico:eq[2].id,data:addDias(hoje(),2),hora:'08:00',duracao:8,prioridade:'Média',status:'Agendada'});
  put('agenda',{titulo:'Visita técnica — Clínica Vitalis',tipo:'Visita técnica',cliente:cli[2].id,
    responsavel:eq[0].id,data:addDias(hoje(),1),hora:'14:00',local:'Asa Sul'});
  put('agenda',{titulo:'Comissionamento OB-0002',tipo:'Comissionamento',cliente:cli[3].id,
    responsavel:eq[1].id,data:addDias(hoje(),22),hora:'10:00'});
  put('concorrentes',{nome:'Domus Integra',atuacao:'Residencial alto padrão',faixa:'Alta',
    fortes:'Showroom próprio e marca forte',fracos:'Prazo longo de entrega',ultima:'Abriu showroom na 204 Sul'});
  put('ajustes',{saldo_inicial:142900,custo_fixo:38000,empresa:mz.id});
  put('ajustes',{saldo_inicial:26500,custo_fixo:9500,empresa:fl.id});
  [[1,8],[4,20],[3,4]].forEach(x=>put('estoque',{produto:prods[x[0]].id,local:locGo.id,qtd:x[1],tipo:'Entrada',
    data:addDias(hoje(),-15),custo:prods[x[0]].custo,doc:'Saldo inicial filial'}));
  put('financeiro',{tipo:'Pagar',descricao:'Aluguel sala Goiânia',categoria:'Administrativo',valor:3200,
    vencimento:addDias(hoje(),5),empresa:fl.id,status:'Pendente'});
  put('reservas',{obra:ob2.id,produto:prods[5].id,qtd:4,status:'Ativa',data:addDias(hoje(),-18)});
  put('reservas',{obra:ob2.id,produto:prods[3].id,qtd:2,status:'Ativa',data:addDias(hoje(),-18)});
  put('reservas',{obra:ob2.id,produto:prods[2].id,qtd:4,status:'Consumida',data:addDias(hoje(),-18),baixada:addDias(hoje(),-10)});
  put('aditivos',{obra:ob2.id,numero:'AD-01',descricao:'Duas câmeras extras na garagem do subsolo',motivo:'Solicitação do cliente',
    prazo:5,valor:8400,custo_material:3900,custo_mo:1300,status:'Pendente',data:addDias(hoje(),-2)});
  ob1.garantia_ate=addDias(ob1.fim,365);
  ob1.entrega={itens:checklistPara('Corporativo').map(t=>({t:t,ok:true})),recebido_por:'Camila Reis',
    documento:'Gerente administrativa',emitido:ob1.fim};
  put('obras',ob1);
  ob1.cobranca='parcelas';ob2.cobranca='parcelas';
  ob1.centro_lucro=cL('Corporativo');ob1.centro_custo=cC('Instalação e campo');
  ob2.centro_lucro=cL('Predial');ob2.centro_custo=cC('Instalação e campo');
  ob1.entrega.emitido=ob1.fim;
  const sv=n=>S.servicos.find(x=>x.nome===n);
  const it=(nat,r,q)=>({nat:nat,ref:r.id,desc:(ehKit(r)?'[Kit] ':'')+r.nome,qtd:q,
    custo:nat==='Material'?custoProduto(r):Number(r.custo||0),venda:Number(r.venda||0)});
  const opDe=cid=>S.oportunidades.find(o=>o.cliente===cid);
  const mkVenda=(orcNum,cl,ob,itens,valor,dias)=>{
    const op=opDe(cl.id);
    const orc=put('orcamentos',{numero:orcNum,cliente:cl.id,oportunidade:op?op.id:'',vertical:cl.vertical,empresa:ob.empresa||mz.id,
      data:addDias(hoje(),-dias-7),validade:addDias(hoje(),-dias+8),status:'Convertido',itens:itens});
    const t=orcTotais(orc);
    const vd=put('vendas',{numero:'VD-'+String(S.vendas.length+1).padStart(4,'0'),empresa:ob.empresa||mz.id,centro_lucro:ob.centro_lucro,centro_custo:ob.centro_custo,data:addDias(hoje(),-dias),orcamento:orc.id,
      cliente:cl.id,oportunidade:op?op.id:'',canal:op?op.canal:'',vertical:cl.vertical,vendedor:eq[0].id,itens:itens,
      valor_bruto:t.venda,desconto:Math.max(0,t.venda-valor),valor:valor,custo:t.custo,margem:(valor-t.custo)/valor*100,
      entrega:'Obra',cobranca:'Parcelas',forma:'Boleto',obra:ob.id,status:'Fechada'});
    orc.venda=vd.id;put('orcamentos',orc);ob.venda=vd.id;ob.orcamento=orc.id;put('obras',ob);
    const cvd=put('contratos',{tipo:'Cliente',subtipo:'Venda',numero:'CT-'+String(S.contratos.filter(ehCtrVenda).length+1).padStart(4,'0'),
      cliente:cl.id,empresa:ob.empresa||mz.id,venda:vd.id,obra:ob.id,objeto:(op?op.titulo:ob.titulo),valor:valor,desconto:Math.max(0,t.venda-valor),
      forma:'Boleto',cobranca:'Parcelas',prazo_dias:45,garantia_meses:12,data_venda:vd.data,assinado_em:addDias(vd.data,2),
      assinado_por:cl.contato||'',status:ob.status==='Concluída'?'Concluído':'Assinado',garantia_ate:ob.garantia_ate||''});
    vd.contrato=cvd.id;put('vendas',vd);
    S.financeiro.filter(l=>l.obra===ob.id&&l.tipo==='Receber').forEach(l=>{l.venda=vd.id;put('financeiro',l)});
  };
  ob1.empresa=fl.id;put('obras',ob1);
  const cl4=cli[4];cl4.cidade='Goiânia';put('clientes',cl4);
  mkVenda('ORC-0001',cli[4],ob1,[it('Material',k2,2),it('Material',prods[0],1),it('Serviço',sv('Projeto executivo e diagramas'),1),
    it('Serviço',sv('Instalação e cabeamento'),96),it('Serviço',sv('Programação e cenas'),40)],54700,52);
  mkVenda('ORC-0002',cli[3],ob2,[it('Material',prods[0],1),it('Material',prods[2],4),it('Material',prods[5],4),it('Material',prods[3],2),
    it('Serviço',sv('Projeto executivo e diagramas'),1),it('Serviço',sv('Instalação e cabeamento'),360),
    it('Serviço',sv('Programação e cenas'),130),it('Serviço',sv('Comissionamento e treinamento'),1)],126900,22);
  const opA=opDe(cli[0].id);
  put('orcamentos',{numero:'ORC-0003',cliente:cli[0].id,oportunidade:opA?opA.id:'',vertical:'Residencial',data:addDias(hoje(),-3),
    validade:addDias(hoje(),12),status:'Enviado',itens:[it('Material',k1,4),it('Material',prods[3],2),it('Material',prods[0],1),
    it('Serviço',sv('Projeto executivo e diagramas'),1),it('Serviço',sv('Instalação e cabeamento'),80),it('Serviço',sv('Programação e cenas'),32)]});
  S.contratos.forEach(c=>{if(!c.tipo){c.tipo='Cliente';c.subtipo='Manutenção';c.dia_venc=10;put('contratos',c)}});
  S.os.forEach(o=>{if(!o.cobranca){o.cobranca=cobrOS(o);put('os',o)}});
  const fImob=put('fornecedores',{nome:'Imobiliária Planalto',cnpj:'33444555000166',categoria:'Aluguel',prazo:0});
  const fSoft=put('fornecedores',{nome:'Nuvem Projetos Software',cnpj:'77888999000122',categoria:'Software',prazo:0});
  const fVei=put('fornecedores',{nome:'LocaFrota Veículos',cnpj:'22333444000199',categoria:'Locação',prazo:0});
  const cAlu=put('contratos',{tipo:'Fornecedor',fornecedor:fImob.id,empresa:mz.id,objeto:'Aluguel do galpão SIA',categoria:'Administrativo',
    centro_custo:cC('Administrativo'),valor:6800,periodicidade:'Mensal',dia_venc:5,aviso:90,inicio:addDias(hoje(),-400),fim:addDias(hoje(),330),
    reajuste:'IGP-M',mes_reajuste:String(Number(addDias(hoje(),-400).slice(5,7))),status:'Ativo'});
  put('contratos',{tipo:'Fornecedor',fornecedor:fSoft.id,empresa:mz.id,objeto:'Licença do software de projetos (5 usuários)',categoria:'Administrativo',
    centro_custo:cC('Engenharia e projetos'),valor:4200,periodicidade:'Anual',dia_venc:15,inicio:addDias(hoje(),-340),fim:addDias(hoje(),25),
    reajuste:'IPCA',status:'Ativo'});
  put('contratos',{tipo:'Fornecedor',fornecedor:fVei.id,empresa:mz.id,objeto:'Locação de 2 vans para as equipes',categoria:'Terceiros',
    centro_custo:cC('Instalação e campo'),valor:7400,periodicidade:'Mensal',dia_venc:20,aviso:30,inicio:addDias(hoje(),-120),status:'Ativo'});
  S.financeiro.filter(l=>/Aluguel do galpão/.test(l.descricao||'')).forEach(l=>{l.contrato=cAlu.id;l.fornecedor=fImob.id;put('financeiro',l)});
  const ctr1=S.contratos.find(c=>c.obra===ob1.id&&ehCtrCliente(c));
  if(ctr1){ctr1.centro_lucro=cL('Contratos de manutenção');ctr1.centro_custo=cC('Suporte e pós-venda');ctr1.empresa=fl.id;put('contratos',ctr1);
    put('financeiro',{tipo:'Receber',descricao:'Contrato '+ctr1.plano+' · '+mesLabel(mesDe(hoje())),categoria:'Contrato',valor:ctr1.valor,
      vencimento:mesDe(hoje())+'-10',cliente:ctr1.cliente,contrato:ctr1.id,status:'Pendente'})}
  const vt=put('os',{cliente:cli[4].id,tipo:'Visita técnica',descricao:'Levantamento da sala de reunião',tecnico:eq[0].id,
    data:addDias(hoje(),-60),duracao:3,horas_reais:3,status:'Concluída',laudo:'Levantamento de cargas e pontos de rede'});
  const og=put('os',{cliente:cli[4].id,obra:ob1.id,tipo:'Garantia',descricao:'Reprogramar cena de apresentação',tecnico:eq[1].id,
    data:addDias(hoje(),-2),duracao:2.5,horas_reais:2.5,status:'Concluída',laudo:'Cena ajustada'});
  put('apontamentos',{obra:ob1.id,colaborador:eq[1].id,data:og.data,horas:2.5,etapa:'OS · Garantia',os:og.id});
  const osd=put('os',{cliente:cli[4].id,obra:ob1.id,tipo:'Corretiva',cobranca:'Sob demanda',valor:480,descricao:'Incluir cena de videoconferência',
    tecnico:eq[1].id,data:addDias(hoje(),-1),duracao:1.5,horas_reais:1.5,status:'Concluída',laudo:'Nova cena criada e testada'});
  put('apontamentos',{obra:ob1.id,colaborador:eq[1].id,data:osd.data,horas:1.5,etapa:'OS · Corretiva',os:osd.id});
  put('financeiro',{tipo:'Receber',descricao:'OS · '+osd.descricao,categoria:'Serviço',valor:480,vencimento:addDias(hoje(),9),
    cliente:cli[4].id,obra:ob1.id,origem:'os',os:osd.id,status:'Pendente'});
  S.financeiro.filter(l=>/Aluguel/.test(l.descricao||'')).forEach(l=>{l.centro_custo=cC('Administrativo');put('financeiro',l)});
  S.financeiro.filter(l=>/Anúncios/.test(l.descricao||'')).forEach(l=>{l.centro_custo=cC('Marketing');put('financeiro',l)});
  canaisPadrao();
  toast('Dados de exemplo carregados');render();
}

/* ---------- inicialização ---------- */
/* ---------- Firebase (ativado automaticamente quando hospedado no Firebase) ---------- */
const FBV='10.12.2';
const carregarScript=src=>new Promise((ok,err)=>{const e=document.createElement('script');
  e.src=src;e.onload=ok;e.onerror=err;document.head.appendChild(e)});
let fbSubs=[], fbRender=null;
async function bootFirebase(cfg){
  document.getElementById('stat').textContent='conectando…';
  try{for(const m of ['app','auth','firestore','storage'])await carregarScript('https://www.gstatic.com/firebasejs/'+FBV+'/firebase-'+m+'-compat.js')}
  catch(e){document.getElementById('view').innerHTML='<div class="empty">Não foi possível carregar o Firebase. Verifique a conexão.</div>';return}
  firebase.initializeApp(cfg);
  FB=firebase.firestore();MODE='firebase';
  const st=document.getElementById('stat');st.style.cursor='pointer';
  st.onclick=()=>{if(firebase.auth().currentUser&&confirm('Sair do Ative One?'))firebase.auth().signOut()};
  firebase.auth().onAuthStateChanged(u=>u?iniciarSessao(u):telaLogin());
}
function telaLogin(){
  fbSubs.forEach(f=>f());fbSubs=[];COLS.forEach(c=>S[c]=[]);
  document.getElementById('side').style.display='none';
  document.getElementById('burger').style.display='none';
  document.getElementById('stat').textContent='Ative One';
  document.getElementById('ttl').textContent='Entrar';
  document.getElementById('sub').textContent='Acesso restrito à equipe';
  document.getElementById('view').innerHTML='<div class="card" style="max-width:380px;margin:40px auto"><div class="cbody">'+
    '<label class="f"><span>E-mail</span><input type="text" id="lgE" autocomplete="username"></label>'+
    '<label class="f"><span>Senha</span><input type="password" id="lgS" autocomplete="current-password" '+
    'style="width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:7px;background:var(--panel-2)"></label>'+
    '<button class="btn" id="lgB" style="width:100%">Entrar</button><div class="note" id="lgM"></div></div></div>';
  const entrar=()=>{
    const m=document.getElementById('lgM');m.textContent='Entrando…';
    firebase.auth().signInWithEmailAndPassword(document.getElementById('lgE').value.trim(),document.getElementById('lgS').value)
      .catch(e=>{m.textContent=/invalid|wrong|not-found|credential/.test(e.code||'')?'E-mail ou senha incorretos.':'Erro: '+(e.code||e.message)});
  };
  document.getElementById('lgB').onclick=entrar;
  document.getElementById('lgS').onkeydown=e=>{if(e.key==='Enter')entrar()};
}
function iniciarSessao(u){
  document.getElementById('side').style.display='';
  document.getElementById('burger').style.display='';
  document.getElementById('stat').textContent=u.email+' · sair';
  fbSubs.forEach(f=>f());fbSubs=[];
  const pend=new Set(COLS);
  document.getElementById('view').innerHTML='<div class="empty">Carregando dados…</div>';
  COLS.forEach(c=>fbSubs.push(FB.collection(c).onSnapshot(qs=>{
    S[c]=qs.docs.map(d=>Object.assign({},d.data(),{id:d.id}));
    if(pend.has(c)){pend.delete(c);if(!pend.size)render();return}
    clearTimeout(fbRender);fbRender=setTimeout(()=>{if(!ovl.classList.contains('on'))render()},150);
  },e=>toast('Sem permissão para ler '+c+': '+(e.code||'')))));
}

async function boot(){
  const temClaudeRt=typeof claude!=='undefined'&&claude&&claude.use;
  if(!temClaudeRt&&location.protocol.startsWith('http')){
    const cfg=await fetch('/__/firebase/init.json').then(r=>r.ok?r.json():null).catch(()=>null);
    if(cfg&&cfg.projectId)return bootFirebase(cfg);
  }
  lsLoad();render();
  const temClaude=typeof claude!=='undefined'&&claude&&claude.use;
  if(temClaude)claude.use('downloads').then(d=>{DL=d}).catch(()=>{});
  let db=null;
  try{db=await claude.use('db')}catch(e){db=null}
  if(!db){document.getElementById('stat').textContent='salvo neste navegador';return}
  DB=db;MODE='db';
  document.getElementById('stat').textContent='sincronizado';
  const locais={};COLS.forEach(c=>locais[c]=S[c]);
  try{
    const res=await Promise.all(COLS.map(c=>DB.doc('col/'+c).get().catch(()=>null)));
    let vazio=true;
    res.forEach((snap,i)=>{
      const d=snap&&snap.exists?snap.data():null;
      if(d&&Array.isArray(d.items)){S[COLS[i]]=d.items;if(d.items.length)vazio=false}
    });
    if(vazio){COLS.forEach(c=>{if(locais[c]&&locais[c].length){S[c]=locais[c];save(c)}})}
    render();
  }catch(e){}
  COLS.forEach(c=>{
    try{DB.doc('col/'+c).onSnapshot(s=>{
      const d=s.exists?s.data():null;
      if(d&&Array.isArray(d.items)&&JSON.stringify(d.items)!==JSON.stringify(S[c])){S[c]=d.items;if(!ovl.classList.contains('on'))render()}
    },()=>{});}catch(e){}
  });
}
boot();
