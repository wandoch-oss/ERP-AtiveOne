/* ---------- planos de contas: gerencial (DRE gerencial) e contábil (DRE contábil) ---------- */
const TIPOS_DRE=['Receita','Dedução','Custo','Despesa','Receita financeira','Despesa financeira','Imposto sobre o lucro'];
const TIPOS_CONTABIL=['Ativo','Passivo','Patrimônio líquido'].concat(TIPOS_DRE);
const CATS_APOIO=['Serviço','Material','Contrato','Mão de obra','Terceiros','Marketing','Administrativo','Impostos','Outros'];
const PLANOS={plano_gerencial:{tipos:TIPOS_DRE,rot:'Plano gerencial',arq:'plano-gerencial'},plano_contas:{tipos:TIPOS_CONTABIL,rot:'Plano contábil',arq:'plano-contabil'}};
const nivelConta=c=>String(c.codigo||'').split('.').length-1;
const cmpCodigo=(a,b)=>{
  const x=String(a.codigo||'').split('.').map(Number),y=String(b.codigo||'').split('.').map(Number);
  for(let i=0;i<Math.max(x.length,y.length);i++){const d=(x[i]||0)-(y[i]||0);if(d)return d}
  return 0;
};
const rotConta2=c=>c?((c.codigo?c.codigo+' · ':'')+c.nome):'';
const contaAnalitica=c=>ativo(c)&&c.natureza==='Analítica';
const filhosConta=(col,id)=>S[col].filter(x=>x.pai===id);
const semAcento=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();

function validarConta(col,d){
  d.codigo=String(d.codigo||'').trim();
  if(!/^\d+(\.\d+)*$/.test(d.codigo))return 'O código usa números separados por ponto, por exemplo 3.1.01.';
  if(d.pai&&d.pai===d.id)return 'Uma conta não pode ser filha dela mesma.';
  const pai=byId(col,d.pai);
  if(pai&&!d.codigo.startsWith(pai.codigo+'.'))return 'O código da conta deve começar com o código do pai ('+pai.codigo+'.).';
  if(!pai&&d.codigo.includes('.'))return 'Conta com ponto no código precisa de uma conta pai.';
  if(pai&&pai.natureza==='Analítica')return 'O pai precisa ser uma conta sintética (de agrupamento).';
  if(d.id&&d.natureza==='Analítica'&&filhosConta(col,d.id).length)return 'Esta conta tem contas filhas, então precisa ser sintética.';
  if(d.natureza==='Sintética'){d.categoria_dre='';if(col==='plano_gerencial')d.conta_contabil=''}
  return '';
}
function ligarContaGerencial(m){
  const sel=m.querySelector('#f_conta_gerencial');if(!sel)return;
  sel.onchange=()=>{
    const c=byId('plano_gerencial',sel.value);if(!c)return;
    const cat=m.querySelector('#f_categoria');if(cat&&c.categoria_dre)cat.value=c.categoria_dre;
    const tp=m.querySelector('#f_tipo');
    if(tp){if(['Receita','Receita financeira'].includes(c.tipo))tp.value='Receber';else if(['Custo','Despesa','Despesa financeira','Dedução','Imposto sobre o lucro'].includes(c.tipo))tp.value='Pagar'}
  };
}

/* ---------- planos padrão: empresa de automação residencial e predial ---------- */
// [código, nome, tipo, S|A]
const CONTABIL_PADRAO=[
 ['1','ATIVO','Ativo','S'],['1.1','Ativo circulante','Ativo','S'],
 ['1.1.01','Caixa e equivalentes de caixa','Ativo','S'],['1.1.01.01','Caixa','Ativo','A'],['1.1.01.02','Bancos conta movimento','Ativo','A'],['1.1.01.03','Aplicações financeiras','Ativo','A'],
 ['1.1.02','Clientes','Ativo','S'],['1.1.02.01','Clientes nacionais','Ativo','A'],
 ['1.1.03','Adiantamentos','Ativo','S'],['1.1.03.01','Adiantamentos a fornecedores','Ativo','A'],
 ['1.1.04','Estoques','Ativo','S'],['1.1.04.01','Equipamentos e materiais para revenda','Ativo','A'],
 ['1.1.05','Tributos a recuperar','Ativo','S'],['1.1.05.01','Impostos a recuperar','Ativo','A'],
 ['1.2','Ativo não circulante','Ativo','S'],
 ['1.2.01','Imobilizado','Ativo','S'],['1.2.01.01','Veículos','Ativo','A'],['1.2.01.02','Máquinas, ferramentas e instrumentos','Ativo','A'],['1.2.01.03','Móveis e equipamentos de informática','Ativo','A'],['1.2.01.09','(−) Depreciação acumulada','Ativo','A'],
 ['1.2.02','Intangível','Ativo','S'],['1.2.02.01','Software e licenças','Ativo','A'],
 ['2','PASSIVO','Passivo','S'],['2.1','Passivo circulante','Passivo','S'],
 ['2.1.01','Fornecedores','Passivo','S'],['2.1.01.01','Fornecedores nacionais','Passivo','A'],
 ['2.1.02','Obrigações trabalhistas','Passivo','S'],['2.1.02.01','Salários e pró-labore a pagar','Passivo','A'],['2.1.02.02','Encargos sociais a recolher','Passivo','A'],['2.1.02.03','Provisão de férias e 13º salário','Passivo','A'],
 ['2.1.03','Obrigações tributárias','Passivo','S'],['2.1.03.01','Impostos sobre faturamento a recolher','Passivo','A'],['2.1.03.02','IRPJ e CSLL a recolher','Passivo','A'],
 ['2.1.04','Empréstimos e financiamentos (curto prazo)','Passivo','S'],['2.1.04.01','Empréstimos bancários','Passivo','A'],
 ['2.1.05','Adiantamentos de clientes','Passivo','S'],['2.1.05.01','Valores recebidos de contratos a executar','Passivo','A'],
 ['2.2','Passivo não circulante','Passivo','S'],['2.2.01','Empréstimos e financiamentos (longo prazo)','Passivo','S'],['2.2.01.01','Empréstimos bancários de longo prazo','Passivo','A'],
 ['2.3','Patrimônio líquido','Patrimônio líquido','S'],['2.3.01','Capital social','Patrimônio líquido','S'],['2.3.01.01','Capital subscrito','Patrimônio líquido','A'],
 ['2.3.02','Reservas e resultados acumulados','Patrimônio líquido','S'],['2.3.02.01','Reservas de lucros','Patrimônio líquido','A'],['2.3.02.02','Lucros ou prejuízos acumulados','Patrimônio líquido','A'],
 ['3','RECEITAS','Receita','S'],
 ['3.1','Receita operacional bruta','Receita','S'],['3.1.01','Venda de equipamentos e materiais','Receita','A'],['3.1.02','Serviços de instalação e comissionamento','Receita','A'],
 ['3.1.03','Projetos e consultoria','Receita','A'],['3.1.04','Contratos de manutenção e suporte','Receita','A'],['3.1.05','Serviços sob demanda e visitas técnicas','Receita','A'],
 ['3.2','Deduções da receita bruta','Dedução','S'],['3.2.01','ICMS, PIS e COFINS sobre vendas','Dedução','A'],['3.2.02','ISS sobre serviços','Dedução','A'],
 ['3.2.03','Simples Nacional (DAS)','Dedução','A'],['3.2.04','Devoluções, descontos e abatimentos','Dedução','A'],
 ['4','CUSTOS','Custo','S'],
 ['4.1','Custo das mercadorias vendidas','Custo','S'],['4.1.01','Equipamentos e materiais vendidos','Custo','A'],['4.1.02','Fretes e seguros sobre compras','Custo','A'],
 ['4.2','Custo dos serviços prestados','Custo','S'],['4.2.01','Mão de obra técnica','Custo','A'],['4.2.02','Terceiros e subempreitadas','Custo','A'],
 ['4.2.03','Deslocamento e hospedagem em obra','Custo','A'],['4.2.04','Materiais de consumo e infraestrutura de obra','Custo','A'],['4.2.05','Garantia e retrabalho','Custo','A'],
 ['5','DESPESAS OPERACIONAIS','Despesa','S'],
 ['5.1','Despesas comerciais','Despesa','S'],['5.1.01','Marketing e publicidade','Despesa','A'],['5.1.02','Comissões e indicações','Despesa','A'],['5.1.03','Eventos, brindes e relacionamento','Despesa','A'],
 ['5.2','Despesas administrativas','Despesa','S'],['5.2.01','Pessoal administrativo','Despesa','A'],['5.2.02','Aluguel e condomínio','Despesa','A'],['5.2.03','Software e licenças','Despesa','A'],
 ['5.2.04','Serviços profissionais (contabilidade, jurídico)','Despesa','A'],['5.2.05','Veículos e combustível','Despesa','A'],['5.2.06','Energia, água e internet','Despesa','A'],
 ['5.2.07','Depreciação e amortização','Despesa','A'],['5.2.08','Outras despesas administrativas','Despesa','A'],
 ['5.3','Despesas tributárias','Despesa','S'],['5.3.01','Impostos e taxas (IPTU, alvarás e outros)','Despesa','A'],
 ['6','RESULTADO FINANCEIRO','Receita financeira','S'],
 ['6.1','Receitas financeiras','Receita financeira','S'],['6.1.01','Rendimentos de aplicações','Receita financeira','A'],['6.1.02','Juros e multas recebidos','Receita financeira','A'],
 ['6.2','Despesas financeiras','Despesa financeira','S'],['6.2.01','Tarifas bancárias','Despesa financeira','A'],['6.2.02','Juros e encargos pagos','Despesa financeira','A'],['6.2.03','IOF e multas','Despesa financeira','A'],
 ['7','IMPOSTOS SOBRE O LUCRO','Imposto sobre o lucro','S'],['7.1','Provisão para IRPJ e CSLL','Imposto sobre o lucro','S'],['7.1.01','IRPJ','Imposto sobre o lucro','A'],['7.1.02','CSLL','Imposto sobre o lucro','A']
];
// [código, nome, tipo, S|A, código da conta contábil, categoria de apoio]
const GERENCIAL_PADRAO=[
 ['1','RECEITA BRUTA','Receita','S'],
 ['1.1','Venda de equipamentos','Receita','S'],
 ['1.1.01','Equipamentos de automação e iluminação','Receita','A','3.1.01','Material'],['1.1.02','Áudio, vídeo e home theater','Receita','A','3.1.01','Material'],
 ['1.1.03','CFTV, alarme e controle de acesso','Receita','A','3.1.01','Material'],['1.1.04','Redes, infraestrutura e energia','Receita','A','3.1.01','Material'],
 ['1.2','Serviços','Receita','S'],
 ['1.2.01','Instalação e comissionamento','Receita','A','3.1.02','Serviço'],['1.2.02','Projetos executivos e consultoria','Receita','A','3.1.03','Serviço'],
 ['1.2.03','Programação e integração de sistemas','Receita','A','3.1.02','Serviço'],['1.2.04','Visitas técnicas e serviços sob demanda','Receita','A','3.1.05','Serviço'],
 ['1.3','Receita recorrente (ATIVE SERVICE)','Receita','S'],
 ['1.3.01','Contratos de manutenção','Receita','A','3.1.04','Contrato'],['1.3.02','Monitoramento e suporte remoto','Receita','A','3.1.04','Contrato'],
 ['2','DEDUÇÕES DA RECEITA','Dedução','S'],
 ['2.1','Impostos sobre vendas e serviços','Dedução','S'],
 ['2.1.01','ISS','Dedução','A','3.2.02','Impostos'],['2.1.02','ICMS, PIS e COFINS','Dedução','A','3.2.01','Impostos'],['2.1.03','Simples Nacional (DAS)','Dedução','A','3.2.03','Impostos'],
 ['2.1.04','Devoluções e descontos concedidos','Dedução','A','3.2.04','Outros'],
 ['3','CUSTOS DIRETOS','Custo','S'],
 ['3.1','Materiais e equipamentos aplicados','Custo','S'],
 ['3.1.01','Equipamentos de automação e iluminação','Custo','A','4.1.01','Material'],['3.1.02','Áudio, vídeo, CFTV e acesso','Custo','A','4.1.01','Material'],
 ['3.1.03','Cabos, infraestrutura e consumíveis de obra','Custo','A','4.2.04','Material'],['3.1.04','Fretes e seguros sobre compras','Custo','A','4.1.02','Material'],
 ['3.2','Mão de obra e terceiros','Custo','S'],
 ['3.2.01','Técnicos de campo','Custo','A','4.2.01','Mão de obra'],['3.2.02','Programação e comissionamento','Custo','A','4.2.01','Mão de obra'],['3.2.03','Terceiros e subempreitadas','Custo','A','4.2.02','Terceiros'],
 ['3.3','Custos de obra','Custo','S'],
 ['3.3.01','Deslocamento e hospedagem','Custo','A','4.2.03','Terceiros'],['3.3.02','Garantia e retrabalho','Custo','A','4.2.05','Terceiros'],
 ['4','DESPESAS COMERCIAIS','Despesa','S'],
 ['4.1','Marketing','Despesa','S'],['4.1.01','Marketing digital (Google, Meta, TikTok)','Despesa','A','5.1.01','Marketing'],['4.1.02','Marketing offline e eventos','Despesa','A','5.1.03','Marketing'],
 ['4.2','Vendas','Despesa','S'],['4.2.01','Comissões de vendedores','Despesa','A','5.1.02','Administrativo'],['4.2.02','Comissões de parceiros e indicações','Despesa','A','5.1.02','Administrativo'],['4.2.03','Brindes e relacionamento com clientes','Despesa','A','5.1.03','Marketing'],
 ['5','DESPESAS ADMINISTRATIVAS','Despesa','S'],
 ['5.1','Pessoal administrativo','Despesa','S'],['5.1.01','Salários administrativos','Despesa','A','5.2.01','Administrativo'],['5.1.02','Encargos e benefícios','Despesa','A','5.2.01','Administrativo'],['5.1.03','Pró-labore','Despesa','A','5.2.01','Administrativo'],
 ['5.2','Estrutura','Despesa','S'],['5.2.01','Aluguel e condomínio','Despesa','A','5.2.02','Administrativo'],['5.2.02','Energia, água e internet','Despesa','A','5.2.06','Administrativo'],
 ['5.2.03','Software e licenças','Despesa','A','5.2.03','Administrativo'],['5.2.04','Veículos e combustível','Despesa','A','5.2.05','Administrativo'],['5.2.05','Manutenção de equipamentos e instalações','Despesa','A','5.2.08','Administrativo'],
 ['5.3','Serviços profissionais','Despesa','S'],['5.3.01','Contabilidade e jurídico','Despesa','A','5.2.04','Administrativo'],['5.3.02','Consultorias','Despesa','A','5.2.04','Administrativo'],
 ['5.4','Outras despesas','Despesa','S'],['5.4.01','Impostos e taxas administrativas','Despesa','A','5.3.01','Impostos'],['5.4.02','Depreciação e amortização','Despesa','A','5.2.07','Administrativo'],['5.4.03','Outras despesas administrativas','Despesa','A','5.2.08','Administrativo'],
 ['6','RESULTADO FINANCEIRO','Receita financeira','S'],
 ['6.1','Receitas financeiras','Receita financeira','S'],['6.1.01','Rendimentos de aplicações','Receita financeira','A','6.1.01','Outros'],['6.1.02','Juros e multas recebidos','Receita financeira','A','6.1.02','Outros'],
 ['6.2','Despesas financeiras','Despesa financeira','S'],['6.2.01','Tarifas bancárias','Despesa financeira','A','6.2.01','Outros'],['6.2.02','Juros e encargos pagos','Despesa financeira','A','6.2.02','Outros'],['6.2.03','IOF e multas','Despesa financeira','A','6.2.03','Outros'],
 ['7','IMPOSTOS SOBRE O LUCRO','Imposto sobre o lucro','S'],['7.1','IRPJ e CSLL','Imposto sobre o lucro','S'],['7.1.01','IRPJ e CSLL do período','Imposto sobre o lucro','A','7.1.01','Impostos']
];
// primeira versão do plano padrão (substituída): removida automaticamente se estiver intacta
const PLANO_V1_MARCAS=[['1.3.01','Materiais e equipamentos'],['5.1.02','Comissões'],['5.4.01','Outras despesas'],['3.1.01','Instalação e projetos']];

function carregarPlano(col){
  let n=0;
  if(col==='plano_contas'){
    const v1=S.plano_contas.length&&PLANO_V1_MARCAS.every(m=>S.plano_contas.some(c=>c.codigo===m[0]&&c.nome===m[1]));
    if(v1)S.plano_contas.slice().forEach(c=>del('plano_contas',c.id));
  }
  const rows=col==='plano_gerencial'?GERENCIAL_PADRAO:CONTABIL_PADRAO;
  rows.forEach(r=>{
    if(S[col].some(x=>x.codigo===r[0]))return;
    const pc=r[0].includes('.')?r[0].slice(0,r[0].lastIndexOf('.')):'',pai=pc?S[col].find(x=>x.codigo===pc):null;
    const rec={codigo:r[0],nome:r[1],tipo:r[2],natureza:r[3]==='S'?'Sintética':'Analítica',pai:pai?pai.id:'',status:'Ativa'};
    if(col==='plano_gerencial'){rec.categoria_dre=r[5]||'';rec.conta_contabil=''}
    put(col,rec);n++;
  });
  vincularPadrao();
  return n;
}
// liga contas gerenciais do padrão às contábeis do padrão (só as que ainda não têm vínculo)
function vincularPadrao(){
  GERENCIAL_PADRAO.filter(r=>r[4]).forEach(r=>{
    const g=S.plano_gerencial.find(x=>x.codigo===r[0]),c=S.plano_contas.find(x=>x.codigo===r[4]);
    if(g&&c&&!g.conta_contabil){g.conta_contabil=c.id;put('plano_gerencial',g)}
  });
}

/* ---------- classificação dos lançamentos ---------- */
const GER_POR_CAT={Receber:{'Serviço':'1.2.01','Contrato':'1.3.01','Material':'1.1.01','Outros':'1.2.04'},
  Pagar:{'Material':'3.1.01','Mão de obra':'3.2.01','Terceiros':'3.2.03','Marketing':'4.1.01','Administrativo':'5.4.03','Impostos':'5.4.01','Outros':'5.4.03'}};
function contaGerencialPadraoDe(l){
  const cod=(GER_POR_CAT[l.tipo]||{})[l.categoria];
  return cod?S.plano_gerencial.find(x=>x.codigo===cod&&contaAnalitica(x)):null;
}
function contaGerencialDe(l){
  const c=l.conta_gerencial&&byId('plano_gerencial',l.conta_gerencial);
  return c||contaGerencialPadraoDe(l);
}
function classificarLancamentos(){
  let n=0;
  S.financeiro.filter(l=>!l.conta_gerencial).forEach(l=>{
    const c=contaGerencialPadraoDe(l);
    if(c){l.conta_gerencial=c.id;delete l.conta_plano;put('financeiro',l);n++}
  });
  return n;
}

/* ---------- apuração: gerencial e contábil ---------- */
const RECEITA_LIKE=['Receita','Receita financeira'];
const sinalConta=(tipoConta,tipoLanc)=>((RECEITA_LIKE.includes(tipoConta)?tipoLanc==='Receber':tipoLanc==='Pagar')?1:-1);
function apurarGerencial(ano,pertence){
  const proprio={},semConta={n:0,v:0};
  S.financeiro.filter(l=>String(l.vencimento||'').startsWith(ano)&&pertence('financeiro',l)).forEach(l=>{
    const c=contaGerencialDe(l),v=Number(l.valor||0);
    if(!c){semConta.n++;semConta.v+=v;return}
    proprio[c.id]=(proprio[c.id]||0)+sinalConta(c.tipo,l.tipo)*v;
  });
  const mo=S.apontamentos.filter(a=>String(a.data||'').startsWith(ano)&&pertence('apontamentos',a)).reduce((acc,a)=>{
    const c=byId('colaboradores',a.colaborador);return acc+Number(a.horas||0)*Number((c&&c.custo_hora)||0)},0);
  const cm=S.plano_gerencial.find(x=>x.codigo==='3.2.01'&&contaAnalitica(x));
  if(mo&&cm)proprio[cm.id]=(proprio[cm.id]||0)+mo;
  return{proprio:proprio,semConta:semConta,mo:mo};
}
function apurarContabil(proprioG){
  const proprio={},semVinculo=[];
  S.plano_gerencial.forEach(g=>{
    const v=proprioG[g.id];if(!v)return;
    const c=g.conta_contabil&&byId('plano_contas',g.conta_contabil);
    if(!c){semVinculo.push({g:g,v:v});return}
    proprio[c.id]=(proprio[c.id]||0)+v;
  });
  return{proprio:proprio,semVinculo:semVinculo};
}
function acumular(col,proprio){
  const soma={};
  S[col].forEach(c=>{
    const v=proprio[c.id];if(!v)return;
    let x=c,g=0;while(x&&g++<12){soma[x.id]=(soma[x.id]||0)+v;x=x.pai?byId(col,x.pai):null}
  });
  return soma;
}
const totalTipo=(col,proprio,tipo)=>S[col].filter(c=>c.natureza==='Analítica'&&c.tipo===tipo).reduce((a,c)=>a+(proprio[c.id]||0),0);
function resultadoDRE(col,proprio){
  const t=x=>totalTipo(col,proprio,x),r={};
  r.receita=t('Receita');r.deducoes=t('Dedução');r.liquida=r.receita-r.deducoes;
  r.custos=t('Custo');r.margem=r.liquida-r.custos;
  r.despesas=t('Despesa');r.operacional=r.margem-r.despesas;
  r.recFin=t('Receita financeira');r.despFin=t('Despesa financeira');r.antesIR=r.operacional+r.recFin-r.despFin;
  r.imposto=t('Imposto sobre o lucro');r.liquido=r.antesIR-r.imposto;
  return r;
}
function tabelaDRE(col,proprio,modo){
  const soma=acumular(col,proprio),r=resultadoDRE(col,proprio),base=r.receita;
  const pc=x=>base?pct(x/base*100):'—';
  const ger=modo==='gerencial';
  const linha=(rot,v,opts)=>{opts=opts||{};
    return '<tr'+(opts.sub?' style="background:var(--panel-2)"':'')+'><td'+(opts.b?' class="s"':'')+' style="padding-left:'+(9+(opts.n||0)*14)+'px">'+rot+'</td><td class="n'+(opts.b?' s':'')+'">'+
      (opts.neg&&v?'('+money(Math.abs(v))+')':money(v))+'</td><td class="n">'+pc(v)+'</td></tr>'};
  const secao=(tipo,rot,neg)=>{
    const nodes=S[col].filter(c=>c.tipo===tipo&&soma[c.id]&&!(c.natureza==='Sintética'&&nivelConta(c)===0)).sort(cmpCodigo);
    const tot=totalTipo(col,proprio,tipo);
    let h=linha(rot,tot,{b:1,neg:neg});
    nodes.forEach(c=>{h+=linha(esc(rotConta2(c)),soma[c.id],{n:Math.max(0,nivelConta(c)-1),neg:neg,b:c.natureza==='Sintética'})});
    return h;
  };
  let h='<div class="scr"><table><thead><tr><th>Linha</th><th class="n">Valor</th><th class="n">% da receita bruta</th></tr></thead><tbody>';
  h+=secao('Receita','Receita bruta');
  h+=secao('Dedução','(−) Deduções da receita',true);
  h+=linha('= Receita líquida',r.liquida,{b:1,sub:1});
  h+=secao('Custo',ger?'(−) Custos diretos':'(−) Custos (CMV e CSP)',true);
  h+=linha(ger?'= Margem de contribuição':'= Lucro bruto',r.margem,{b:1,sub:1});
  h+=secao('Despesa','(−) Despesas operacionais',true);
  h+=linha('= Resultado operacional',r.operacional,{b:1,sub:1});
  h+=secao('Receita financeira','(+) Receitas financeiras');
  h+=secao('Despesa financeira','(−) Despesas financeiras',true);
  h+=linha('= Resultado antes dos impostos sobre o lucro',r.antesIR,{b:1,sub:1});
  h+=secao('Imposto sobre o lucro','(−) Impostos sobre o lucro',true);
  h+=linha(ger?'= Resultado líquido gerencial':'= Lucro líquido do período',r.liquido,{b:1,sub:1});
  return{html:h+'</tbody></table></div>',r:r};
}
function avisoDRE(sem,semVinc){
  let h='';
  if(sem&&sem.n)h+='<div class="note" style="color:var(--amber)">'+sem.n+' lançamento(s) do ano ('+money(sem.v)+') sem conta gerencial e sem categoria reconhecida ficaram fora do DRE. Classifique-os em Cadastros → Plano gerencial.</div>';
  if(semVinc&&semVinc.length)h+='<div class="note" style="color:var(--amber)">Contas gerenciais sem conta contábil vinculada (fora do DRE contábil): '+
    semVinc.map(x=>esc(rotConta2(x.g))+' ('+money(x.v)+')').join('; ')+'. Vincule em Cadastros → Plano gerencial.</div>';
  return h;
}
function dreGerencial(ano,pertence){
  const a=apurarGerencial(ano,pertence),t=tabelaDRE('plano_gerencial',a.proprio,'gerencial');
  return{html:t.html+avisoDRE(a.semConta,null),r:t.r,ap:a};
}
R.dre_contabil=v=>{
  const ano=hoje().slice(0,4);
  if(!S.plano_gerencial.length||!S.plano_contas.length){
    v.innerHTML='<div class="card"><div class="cbody"><div class="empty">O DRE contábil usa o plano gerencial ligado ao plano contábil. Carregue os dois em Cadastros. '+
      '<button class="btn sm" id="go">Abrir Cadastros</button></div></div></div>';
    document.getElementById('go').onclick=()=>{route='cadastros';cadTab='plano_gerencial';render()};return;
  }
  const a=apurarGerencial(ano,naUnid),c=apurarContabil(a.proprio),t=tabelaDRE('plano_contas',c.proprio,'contabil'),g=resultadoDRE('plano_gerencial',a.proprio);
  const dif=g.liquido-t.r.liquido;
  v.innerHTML='<div class="kpis">'+kpi('Receita bruta '+ano,money(t.r.receita))+kpi('Lucro bruto',money(t.r.margem),t.r.receita?pct(t.r.margem/t.r.receita*100):'')+
    kpi('Resultado operacional',money(t.r.operacional))+kpi('Lucro líquido',money(t.r.liquido),t.r.receita?pct(t.r.liquido/t.r.receita*100)+' da receita':'')+'</div>'+
    '<div class="card"><div class="chead"><h2>DRE contábil · '+ano+(UNID?' · '+esc(nomeUnid(UNID)):'')+'</h2><span class="hint">gerado pelo plano gerencial ligado ao plano contábil</span></div><div class="cbody">'+t.html+
    avisoDRE(a.semConta,c.semVinculo)+
    '<div class="note">Conciliação: resultado do DRE gerencial '+money(g.liquido)+' · DRE contábil '+money(t.r.liquido)+(Math.abs(dif)>0.005?' · diferença '+money(dif)+' (contas gerenciais sem vínculo contábil).':' · batem.')+'</div></div></div>';
};

/* ---------- importação por arquivo (CSV) ---------- */
const MODELO_PLANO={
 plano_contas:'codigo;nome;tipo;natureza\n1;ATIVO;Ativo;Sintética\n1.1;Ativo circulante;Ativo;Sintética\n1.1.01;Caixa e bancos;Ativo;Sintética\n1.1.01.02;Bancos conta movimento;Ativo;Analítica\n3;RECEITAS;Receita;Sintética\n3.1;Receita operacional bruta;Receita;Sintética\n3.1.02;Serviços de instalação;Receita;Analítica\n4;CUSTOS;Custo;Sintética\n4.2;Custo dos serviços;Custo;Sintética\n4.2.01;Mão de obra técnica;Custo;Analítica\n',
 plano_gerencial:'codigo;nome;tipo;natureza;conta_contabil;categoria_apoio\n1;RECEITA BRUTA;Receita;Sintética;;\n1.2;Serviços;Receita;Sintética;;\n1.2.01;Instalação e comissionamento;Receita;Analítica;3.1.02;Serviço\n3;CUSTOS DIRETOS;Custo;Sintética;;\n3.2;Mão de obra;Custo;Sintética;;\n3.2.01;Técnicos de campo;Custo;Analítica;4.2.01;Mão de obra\n'
};
function tipoPorCodigo(cod){const d=String(cod)[0];return {1:'Ativo',2:'Passivo',3:'Receita',4:'Custo'}[d]||'Despesa'}
function lerPlanoCSV(t){
  const linhas=t.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());if(!linhas.length)return[];
  const sep=[';','\t',','].map(x=>[x,linhas.slice(0,8).join('\n').split(x).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=linhas.map(l=>splitCSV(l,sep));
  const hi=rows.findIndex(r=>r.some(c=>/^(c[oó]digo|conta$|classifica)/i.test(c.trim()))&&r.some(c=>/nome|descri|t[ií]tulo/i.test(c)));
  const H=hi>=0?rows[hi].map(semAcento):[],col=re=>H.findIndex(c=>re.test(c));
  let cc=col(/^(codigo|classifica)/),cn=col(/nome|descri|titulo/),ct=col(/^tipo/),cna=col(/natureza|sintetica|analitica/),cd=col(/apoio|dre|linha/),cl=col(/contabil/);
  if(cc<0&&hi>=0)cc=col(/^conta$/);
  if(hi<0){cc=0;cn=1;ct=-1;cna=-1;cd=-1;cl=-1}
  const out=[];
  rows.slice(hi+1).forEach(r=>{
    const cod=String(r[cc]||'').trim().replace(/\s+/g,'').replace(/\.+$/,''),nome=String(r[cn]||'').trim();
    if(!/^\d+(\.\d+)*$/.test(cod)||!nome)return;
    out.push({codigo:cod,nome:nome,tipo:ct>=0?r[ct]:'',natureza:cna>=0?r[cna]:'',apoio:cd>=0?r[cd]:'',contabil:cl>=0?String(r[cl]||'').trim():''});
  });
  return out;
}
function planejarImportacao(col,linhas){
  const tipos=PLANOS[col].tipos,unico=new Map();linhas.forEach(l=>{if(!unico.has(l.codigo))unico.set(l.codigo,l)});
  const existentes=[],criar=new Map(),cods=new Set([...unico.keys()].concat(S[col].map(c=>c.codigo)));
  const tipoOk=t=>tipos.find(x=>semAcento(x)===semAcento(t))||'';
  const catOk=t=>CATS_APOIO.find(x=>semAcento(x)===semAcento(t))||'';
  const natOk=(l,cod)=>{const n=semAcento(l.natureza);if(n.startsWith('s'))return 'Sintética';if(n.startsWith('a'))return 'Analítica';
    return [...cods].some(c=>c.startsWith(cod+'.'))?'Sintética':'Analítica'};
  unico.forEach((l,cod)=>{
    if(S[col].some(c=>c.codigo===cod)){existentes.push(cod);return}
    const nat=natOk(l,cod);
    criar.set(cod,{codigo:cod,nome:l.nome,tipo:tipoOk(l.tipo)||(col==='plano_gerencial'&&tipoPorCodigo(cod)==='Ativo'?'Despesa':tipoPorCodigo(cod)),natureza:nat,
      categoria_dre:nat==='Analítica'?catOk(l.apoio):'',contabil:nat==='Analítica'?l.contabil:''});
  });
  let auto=0;
  [...criar.keys()].forEach(cod=>{
    let p=cod;
    while(p.includes('.')){p=p.slice(0,p.lastIndexOf('.'));
      if(cods.has(p)||criar.has(p))continue;
      criar.set(p,{codigo:p,nome:'Grupo '+p,tipo:criar.get(cod).tipo,natureza:'Sintética',categoria_dre:'',contabil:''});cods.add(p);auto++}
  });
  return{lista:[...criar.values()].sort(cmpCodigo),existentes:existentes,auto:auto};
}
async function importarPlanoArquivo(files,col){
  if(!files||!files.length)return;
  let linhas=[];
  for(const f of files){try{linhas=linhas.concat(lerPlanoCSV(await lerTexto(f)))}catch(e){}}
  if(!linhas.length){toast('Não consegui ler contas. Use CSV com as colunas código e nome (tipo e natureza são opcionais).');return}
  const pl=planejarImportacao(col,linhas);
  if(!pl.lista.length){toast('Todas as '+pl.existentes.length+' contas do arquivo já existem no plano');return}
  const ok=await ask('Importar '+pl.lista.length+' conta(s) nova(s)'+(pl.existentes.length?'; '+pl.existentes.length+' já existem e serão mantidas':'')+
    (pl.auto?'; '+pl.auto+' grupo(s) pai ausente(s) serão criados com o nome "Grupo …"':'')+'?','Importar');
  if(!ok)return;
  let semLink=0;
  pl.lista.forEach(c=>{
    const pc=c.codigo.includes('.')?c.codigo.slice(0,c.codigo.lastIndexOf('.')):'',pai=pc?S[col].find(x=>x.codigo===pc):null;
    const rec={codigo:c.codigo,nome:c.nome,tipo:c.tipo,natureza:c.natureza,pai:pai?pai.id:'',status:'Ativa'};
    if(col==='plano_gerencial'){
      rec.categoria_dre=c.categoria_dre;
      const cb=c.contabil&&S.plano_contas.find(x=>x.codigo===c.contabil&&x.natureza==='Analítica');
      rec.conta_contabil=cb?cb.id:'';if(c.natureza==='Analítica'&&!cb)semLink++;
    }
    put(col,rec);
  });
  toast(pl.lista.length+' conta(s) importada(s)'+(semLink?' · '+semLink+' sem vínculo contábil':''));render();
}
