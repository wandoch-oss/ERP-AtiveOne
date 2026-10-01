/* ---------- proposta comercial (modelos Completa e Simplificada) ---------- */
const FRENTES=[
  {k:'control',nome:'ATIVE CONTROL',cat:'Automação',entrega:'Cenas, iluminação, clima e persianas',desc:'Equipamentos + instalação + programação',dim:'pontos'},
  {k:'av',nome:'ATIVE AV',cat:'Áudio e vídeo',entrega:'Som distribuído, home theater e projeção',desc:'Equipamentos + instalação + calibração',dim:'zonas'},
  {k:'secure',nome:'ATIVE SECURE',cat:'Segurança',entrega:'CFTV, controle de acesso e alarme',desc:'Equipamentos + instalação + configuração',dim:'câmeras'},
  {k:'energy',nome:'ATIVE ENERGY',cat:'Energia',entrega:'Geração, medição e gestão de consumo',desc:'Equipamentos + instalação + integração',dim:'circuitos'}];
const FRENTE_PROJ='Projeto executivo', FRENTE_OUTROS='Outros itens';
const OPT_FRENTE=FRENTES.map(f=>f.nome).concat([FRENTE_PROJ,FRENTE_OUTROS]);

function guessFrente(i){
  const p=i.ref&&byId('produtos',i.ref), s=i.ref&&byId('servicos',i.ref);
  const txt=[i.desc,p&&nomeClass('familias',p.familia),p&&nomeClass('categorias',p.categoria),s&&nomeClass('categorias_servico',s.categoria)].filter(Boolean).join(' ');
  if(i.nat==='Serviço'&&/projeto|executivo|engenharia/i.test(txt))return FRENTE_PROJ;
  if(/cftv|c[âa]mera|acesso|alarme|seguran|interfon/i.test(txt))return 'ATIVE SECURE';
  if(/[áa]udio|v[ií]deo|som\b|home theater|projet[oa]r|tv\b|caixa/i.test(txt))return 'ATIVE AV';
  if(/energia|solar|medi[cç][aã]o|consumo|el[eé]trica/i.test(txt))return 'ATIVE ENERGY';
  if(/automa|ilumin|persiana|cena|dimmer|rede|wi-?fi|controlad|m[oó]dulo|sensor|clima|touch/i.test(txt))return 'ATIVE CONTROL';
  return FRENTE_OUTROS;
}
const frenteDe=i=>i.frente||guessFrente(i);

const PROP_PADRAO={
  incluso:['Projeto executivo e diagramas de infraestrutura','Fornecimento dos equipamentos especificados','Programação, configuração e comissionamento',
    'Testes de aceitação e ajustes finais','Treinamento de uso para moradores e equipe','Documentação as-built e credenciais','Garantia conforme item 09'].join('\n'),
  nao_incluso:['Infraestrutura civil: cortes, rasgos e eletrodutos','Quadros elétricos, disjuntores e aterramento','Rede elétrica dedicada e nobreak',
    'Marcenaria, gesso, pintura e acabamento','Link de internet, mobiliário e decoração','Licenças, taxas e aprovações em condomínio'].join('\n'),
  fases:[['Projeto executivo','Diagramas, listas e pontos de infraestrutura'],['Infraestrutura','Acompanhamento de passagem e cabeamento'],
    ['Instalação','Equipamentos, quadros e periféricos'],['Programação','Cenas, integrações e testes'],['Entrega','Comissionamento, treinamento e as-built']],
  premissas:['Disponibilizar a obra em condições de instalação, com infraestrutura civil e elétrica concluída','Fornecer projetos atualizados de arquitetura, elétrica e luminotécnico',
    'Garantir energia estabilizada, aterramento adequado e link de internet ativo','Indicar um responsável único para decisões e aprovações durante a execução',
    'Providenciar guarda dos equipamentos entregues no canteiro','Aprovar cenas e configurações na etapa de comissionamento em até 5 dias'].join('\n'),
  condicoes:['Validade desta proposta: {validade} dias corridos a partir da data de emissão','Os valores contemplam exclusivamente o escopo descrito no item 04',
    'Alterações de escopo serão orçadas em aditivo, com prazo e valor próprios','Início dos trabalhos condicionado à assinatura e ao pagamento da entrada',
    'Esta proposta e seus anexos são confidenciais e de uso exclusivo do cliente'].join('\n'),
  cambial:'Valores em reais, com impostos inclusos. Equipamentos importados podem sofrer reajuste em caso de variação cambial superior a 5% entre a data desta proposta e a ordem de compra — nesse caso, o ajuste é comunicado e aprovado previamente.',
  garantia_instal:'12 meses a partir do aceite',garantia_equip:'Conforme garantia do fabricante — de 12 a 36 meses',
  garantia_atend:'Remoto imediato · presencial em até 24 horas úteis',garantia_excl:'Mau uso, surto elétrico sem proteção, intervenção de terceiros',
  formas:'PIX, transferência ou boleto'
};
const PROP_CAMPOS_TEXTO=['escopo_simp','demanda','premissa_projeto','ambientes','incluso','nao_incluso','premissas','condicoes','cambial'];

function dadosProposta(o){
  const cl=byId('clientes',o.cliente)||{}, op=byId('oportunidades',o.oportunidade)||{}, emp=byId('empresas',o.empresa||empDe('orcamentos',o))||{};
  const ano=(o.data||hoje()).slice(0,4);
  const usados=S.orcamentos.filter(x=>x.proposta&&x.proposta.numero&&x.proposta.numero.startsWith('PC-'+ano)).length;
  const base={
    modelo:'Completa',numero:'PC-'+ano+'-'+String(usados+1).padStart(3,'0'),data:hoje(),
    validade_dias:o.validade?Math.max(1,difDias(o.validade,o.data||hoje())):15,
    contato:[cl.telefone,cl.email].filter(Boolean).join(' · '),projeto:op.titulo||'',
    visita_data:'',premissa_projeto:'',demanda:op.titulo?op.titulo:'',ambientes:'',
    desconto_escala:0,desconto_desc:'Contratação conjunta das frentes',
    pag_1:30,pag_2:40,pag_3:30,cartao_x:'',cartao_juros:'',
    plano_essencial:0,plano_avancado:0,plano_total:0,
    prazo_1:0,prazo_2:0,prazo_3:0,prazo_4:0,prazo_5:0,
    resp_nome:emp.resp_nome||'',local_aceite:''
  };
  Object.assign(base,PROP_PADRAO,{fases:undefined});
  FRENTES.forEach(f=>{base['dim_'+f.k]='';base['desc_'+f.k]=f.desc});
  base.desc_proj='Detalhamento técnico e acompanhamento de obra';base.desc_outros='Demais itens do orçamento';
  const out=Object.assign(base,o.proposta||{});
  if(!out.escopo_simp)out.escopo_simp=totaisFrentes(o).linhas.filter(l=>l.n).map(l=>l.nome+' — '+resumoFrente(o,l.nome)).join('\n');
  return out;
}
function resumoFrente(o,nome){
  const d=(o.itens||[]).filter(i=>frenteDe(i)===nome).map(i=>i.desc);
  return d.slice(0,3).join(', ')+(d.length>3?' e mais '+(d.length-3)+' item(ns)':'');
}
function totaisFrentes(o){
  const mapa={};(o.itens||[]).forEach(i=>{const f=frenteDe(i),v=Number(i.qtd||0)*Number(i.venda||0);
    mapa[f]=mapa[f]||{v:0,n:0};mapa[f].v+=v;mapa[f].n++});
  const linhas=OPT_FRENTE.map(n=>({nome:n,v:(mapa[n]||{v:0}).v,n:(mapa[n]||{n:0}).n}));
  return{linhas:linhas,bruto:linhas.reduce((a,l)=>a+l.v,0)};
}

/* ---------- tela de preparação ---------- */
function gerarProposta(id){
  const o=byId('orcamentos',id);if(!o)return;
  if(!(o.itens||[]).length){toast('Adicione itens ao orçamento antes de gerar a proposta');return}
  if(!o.cliente){toast('Escolha o cliente do orçamento');return}
  let p=dadosProposta(o);
  const inp=(k,l,t,extra)=>'<label class="f"><span>'+l+'</span><input type="'+(t||'text')+'" id="p_'+k+'" value="'+esc(p[k]==null?'':p[k])+'" '+(extra||'')+'></label>';
  const ta=(k,l,rows)=>'<label class="f"><span>'+l+'</span><textarea id="p_'+k+'" rows="'+(rows||4)+'">'+esc(p[k]||'')+'</textarea></label>';
  const num2=(k,l)=>inp(k,l,'number','step="0.01" min="0"');
  const T=totaisFrentes(o);
  const draw=()=>{
    const comp=p.modelo==='Completa';
    let h='<div class="frow"><label class="f"><span>Modelo da proposta</span><select id="p_modelo"><option'+(comp?' selected':'')+'>Completa</option><option'+(comp?'':' selected')+'>Simplificada</option></select></label>'+
      inp('numero','Nº da proposta')+'</div>'+
      '<div class="note" style="margin:-4px 0 10px">Os dados já vêm do orçamento, do cliente e da empresa. Ajuste o que precisar: nada disso altera o orçamento.</div>'+
      '<div class="fsec">Dados da proposta</div>'+
      '<div class="frow">'+inp('data','Data','date')+inp('validade_dias','Validade (dias corridos)','number','step="1" min="1"')+'</div>'+
      '<div class="frow">'+inp('projeto','Projeto / obra')+inp('contato','Contato do cliente')+'</div>'+
      '<div class="frow">'+inp('resp_nome','Responsável ATIVE ONE (assinatura)')+'<div></div></div>';
    if(comp)h+='<div class="fsec">Apresentação e demanda</div><div class="frow">'+inp('visita_data','Data da visita técnica','date')+'<div></div></div>'+
      ta('demanda','Necessidades identificadas (uma por linha)',4)+inp('premissa_projeto','Premissa de projeto (ex.: obra em fase de infraestrutura elétrica)')+
      '<div class="fsec">Solução por frente</div><div class="note" style="margin:-4px 0 8px">Cada item do orçamento fica numa frente (coluna "Frente" do orçamento). Aqui você ajusta o texto de cada uma.</div>'+
      FRENTES.filter(f=>T.linhas.find(l=>l.nome===f.nome).n).map(f=>'<div class="frow">'+inp('dim_'+f.k,f.nome+' · dimensionamento (ex.: 40 pontos)')+inp('desc_'+f.k,f.nome+' · descrição do valor')+'</div>').join('')+
      '<div class="frow">'+inp('desc_proj','Projeto executivo · descrição do valor')+inp('desc_outros','Outros itens · descrição do valor')+'</div>'+
      ta('ambientes','Detalhamento por ambiente (opcional). Uma linha por ambiente: Ambiente | Sistemas previstos | Observações',4)+
      '<div class="fsec">Escopo de fornecimento</div><div class="frow">'+ta('incluso','Está incluído (uma por linha)',6)+ta('nao_incluso','Não está incluído (uma por linha)',6)+'</div>'+
      '<div class="fsec">Cronograma (dias úteis por fase)</div><div class="frow">'+PROP_PADRAO.fases.map((f,i)=>inp('prazo_'+(i+1),(i+1)+'. '+f[0],'number','step="1" min="0"')).join('')+'</div>';
    else h+='<div class="fsec">Escopo</div>'+ta('escopo_simp','Sistemas fornecidos (uma linha por sistema)',5)+
      '<div class="frow">'+inp('prazo_1','Prazo de execução (dias úteis)','number','step="1" min="0"')+'<div></div></div>';
    h+='<div class="fsec">Investimento</div><div class="frow">'+num2('desconto_escala','Desconto de escala (R$), só no documento')+inp('desconto_desc','Descrição do desconto')+'</div>'+
      '<div class="note" style="margin:-4px 0 8px">Subtotal pelos itens do orçamento: <b>'+money(T.bruto)+'</b>. O desconto de escala aparece como uma linha da proposta e não muda o orçamento nem a venda.</div>'+
      '<div class="fsec">Condições de pagamento (%)</div><div class="frow">'+inp('pag_1','Entrada (na assinatura)','number','step="1" min="0"')+inp('pag_2','2ª parcela (início da instalação)','number','step="1" min="0"')+'</div>'+
      '<div class="frow">'+inp('pag_3','3ª parcela (entrega e aceite)','number','step="1" min="0"')+inp('formas','Formas aceitas')+'</div>'+
      '<div class="frow">'+inp('cartao_x','Cartão em até (x)','number','step="1" min="0"')+inp('cartao_juros','Juros do cartão (% a.m.)','number','step="0.01" min="0"')+'</div>';
    if(comp)h+=ta('cambial','Observação sobre valores e câmbio',3)+
      '<div class="fsec">Pós-obra — ATIVE SERVICE (mensalidade, R$)</div><div class="frow">'+num2('plano_essencial','Essencial')+num2('plano_avancado','Avançado')+'</div><div class="frow">'+num2('plano_total','Total')+'<div></div></div>'+
      '<div class="fsec">Premissas e garantia</div>'+ta('premissas','Responsabilidades do cliente (uma por linha)',6)+
      '<div class="frow">'+inp('garantia_instal','Garantia · instalação e programação')+inp('garantia_equip','Garantia · equipamentos')+'</div>'+
      '<div class="frow">'+inp('garantia_atend','Garantia · atendimento')+inp('garantia_excl','Garantia · exclusões')+'</div>'+
      ta('condicoes','Condições comerciais (uma por linha; use {validade} para os dias)',5);
    else h+='<div class="frow">'+num2('plano_essencial','Pós-obra: plano ATIVE SERVICE a partir de (R$/mês, opcional)')+'<div></div></div>'+
      '<div class="frow">'+inp('garantia_instal','Garantia · instalação')+inp('garantia_equip','Garantia · equipamentos')+'</div>';
    modal.className='wide';
    modal.innerHTML='<div class="mhead"><h3>Gerar proposta · '+esc(o.numero)+'</h3><button class="x" onclick="closeM()">&times;</button></div><div class="mbody">'+h+'</div>'+
      '<div class="mfoot"><button class="btn sec" id="pBack">Voltar ao orçamento</button><button class="btn" id="pGo">Visualizar proposta</button></div>';
    ovl.classList.add('on');
    document.getElementById('p_modelo').onchange=()=>{lerP();draw()};
    document.getElementById('pBack').onclick=()=>{lerP();salvarP();editorOrc(o.id)};
    document.getElementById('pGo').onclick=()=>{
      lerP();
      const s=Number(p.pag_1||0)+Number(p.pag_2||0)+Number(p.pag_3||0);
      if(Math.abs(s-100)>0.01){toast('As parcelas somam '+s+'%. Ajuste para 100%.');return}
      salvarP();previaProposta(o.id);
    };
  };
  const lerP=()=>{modal.querySelectorAll('[id^="p_"]').forEach(el=>{
    const k=el.id.slice(2);p[k]=el.type==='number'?(el.value===''?0:Number(el.value)):el.value})};
  const salvarP=()=>{o.proposta=Object.assign({},p);put('orcamentos',o)};
  draw();
}

/* ---------- visualização, impressão e download ---------- */
function previaProposta(id){
  const o=byId('orcamentos',id),p=dadosProposta(o);
  const html=propostaHtml(o,p);
  const nome='Proposta-'+p.numero+'-'+String(nm('clientes',o.cliente)).replace(/[^\w]+/g,'-').slice(0,40)+'.html';
  modal.className='wide';
  modal.innerHTML='<div class="mhead"><h3>Proposta '+esc(p.numero)+' · '+esc(p.modelo)+'</h3><button class="x" onclick="closeM()">&times;</button></div>'+
    '<div class="mbody" style="padding:0"><iframe id="pFr" style="width:100%;height:68vh;border:0;background:#888" title="Proposta"></iframe></div>'+
    '<div class="mfoot"><button class="btn sec" id="pEd">Editar dados</button><button class="btn sec" id="pDl">Baixar arquivo (HTML)</button><button class="btn" id="pPr">Imprimir / salvar PDF</button></div>';
  ovl.classList.add('on');
  document.getElementById('pFr').srcdoc=html;
  document.getElementById('pEd').onclick=()=>gerarProposta(id);
  document.getElementById('pDl').onclick=()=>baixarArquivo(nome,html);
  document.getElementById('pPr').onclick=()=>{
    const f=document.getElementById('pFr');
    try{f.contentWindow.focus();f.contentWindow.print()}catch(e){toast('Baixe o arquivo e abra no navegador para imprimir')}
  };
}

/* ---------- documento ---------- */
const LOGO_SVG=(w)=>'<svg class="lg" viewBox="0 0 400 160" width="'+w+'" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gA" x1="0" y1="0" x2="1" y2="1">'+
  '<stop offset="0" stop-color="#d8dbe0"/><stop offset=".5" stop-color="#9aa0a9"/><stop offset="1" stop-color="#c9ccd1"/></linearGradient></defs>'+
  '<path fill="url(#gA)" fill-rule="evenodd" d="M80 0 L160 158 H116 L80 80 L44 158 H0 Z"/>'+
  '<g fill="none" stroke="#d8dbe0" stroke-width="7" stroke-linecap="round"><path d="M56 118 A34 34 0 0 1 104 118"/><path d="M64 130 A22 22 0 0 1 96 130"/></g>'+
  '<circle cx="80" cy="142" r="6" fill="#d8dbe0"/>'+
  '<text x="294" y="82" text-anchor="middle" font-family="Poppins,Helvetica,Arial,sans-serif" font-weight="300" font-size="44" letter-spacing="12" fill="#fff">ATIVE</text>'+
  '<line x1="238" y1="102" x2="350" y2="102" stroke="#6b717c" stroke-width="1"/>'+
  '<text x="294" y="130" text-anchor="middle" font-family="Poppins,Helvetica,Arial,sans-serif" font-weight="300" font-size="17" letter-spacing="14" fill="#c9ccd1">ONE</text></svg>';

function propostaHtml(o,p){
  const cl=byId('clientes',o.cliente)||{},emp=byId('empresas',o.empresa||empDe('orcamentos',o))||{};
  const T=totaisFrentes(o),desc=Number(p.desconto_escala||0),total=T.bruto-desc,comp=p.modelo==='Completa';
  const brand=emp.nome_fantasia||'ATIVE ONE',contatoEmp=[emp.site||'www.ativeone.com.br',emp.telefone||emp.whatsapp||'',p.instagram||''].filter(Boolean).join(' · ');
  const linhas=s=>String(s||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const dtx=d=>{if(!d)return '—';const x=String(d).slice(0,10).split('-');return x.length===3?x[2]+'/'+x[1]+'/'+x[0]:d};
  const lista=s=>linhas(s).map(x=>'<div class="b">'+esc(x)+'</div>').join('');
  const money2=v=>money(v).replace(/\s/g,' ');
  const nomeCli=cl.nome||'Cliente',proj=p.projeto||'—';
  const sec=(n,t)=>'<div class="sec"><span class="n">'+n+'</span><span class="t">'+esc(t)+'</span></div>';
  const tb=(cols,rows,cls)=>'<table class="'+(cls||'')+'"><thead><tr>'+cols.map(c=>'<th class="'+(c.r?'r':'')+'" style="'+(c.w?'width:'+c.w:'')+'">'+esc(c.l)+'</th>').join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+r.map((c,i)=>'<td class="'+(cols[i].r?'r':'')+(cols[i].s?' s':'')+'">'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const inv=[];
  FRENTES.forEach(f=>{const l=T.linhas.find(x=>x.nome===f.nome);if(l.n)inv.push([esc(f.nome),esc(p['desc_'+f.k]||''),money2(l.v)])});
  [[FRENTE_PROJ,p.desc_proj],[FRENTE_OUTROS,p.desc_outros]].forEach(a=>{const l=T.linhas.find(x=>x.nome===a[0]);if(l.n)inv.push([esc(a[0]),esc(a[1]||''),money2(l.v)])});
  if(desc>0)inv.push(['Desconto de escala',esc(p.desconto_desc||''),'– '+money2(desc)]);
  const parc=[[p.pag_1,'Entrada','Na assinatura. Libera projeto executivo e compra de equipamentos'],[p.pag_2,'2ª parcela','No início da instalação'],[p.pag_3,'3ª parcela','Na entrega e aceite do sistema']]
    .filter(x=>Number(x[0])>0).map(x=>[esc(x[1]+' — '+x[0]+'% · '+money2(total*Number(x[0])/100)),esc(x[2])]);
  const cartao=Number(p.cartao_x)>0?' · cartão em até '+p.cartao_x+'x'+(Number(p.cartao_juros)>0?' com '+String(p.cartao_juros).replace('.',',')+'% a.m.':''):'';
  parc.push(['Formas aceitas',esc((p.formas||'')+cartao)]);
  const css=`
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500&display=swap');
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#8a8f98;font-family:Poppins,'Helvetica Neue',Arial,sans-serif;font-weight:300;color:#1b2030;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;min-height:297mm;margin:10px auto;background:#fff;position:relative;page-break-after:always;overflow:hidden;display:flex;flex-direction:column}
@media print{html,body{background:#fff}.page{margin:0;page-break-after:always}}
.dark{background:#0a0d14;color:#fff}
.band{background:#0a0d14;background-image:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 1px,transparent 1px 38px);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 14mm;height:15mm}
.band .lg{height:8mm;width:auto}.band .r{font-size:7pt;letter-spacing:.28em;color:#7c8391;text-transform:uppercase}
.body{padding:9mm 14mm 6mm;flex:1}
.foot{display:flex;justify-content:space-between;padding:0 14mm 7mm;font-size:6.5pt;letter-spacing:.2em;color:#9aa0ad;text-transform:uppercase}
.sec{display:flex;align-items:baseline;gap:5mm;border-bottom:1px solid #dfe2e8;padding-bottom:3mm;margin:7mm 0 5mm}
.sec .n{font-size:20pt;font-weight:200;color:#c3c7d0}.sec .t{font-size:9pt;letter-spacing:.3em;text-transform:uppercase;font-weight:400;color:#0a0d14}
p{font-size:9.5pt;line-height:1.65;margin:0 0 3mm;color:#3a4152}
.b{font-size:9.2pt;line-height:1.5;color:#3a4152;padding-left:5mm;position:relative;margin:1.2mm 0}.b:before{content:'';position:absolute;left:0;top:.62em;width:2.6mm;height:1px;background:#0a0d14}
.sub{font-size:7pt;letter-spacing:.28em;text-transform:uppercase;color:#9aa0ad;margin:5mm 0 2mm}
table{width:100%;border-collapse:collapse;font-size:8.8pt;margin:0 0 3mm;page-break-inside:avoid}
th{background:#11172a;color:#cfd3dc;font-weight:400;font-size:6.8pt;letter-spacing:.24em;text-transform:uppercase;text-align:left;padding:2.6mm 3mm}
td{padding:2.7mm 3mm;border-bottom:1px solid #e6e8ee;color:#3a4152;vertical-align:top}tr:nth-child(even) td{background:#f6f7fa}
td.s{color:#0a0d14;font-weight:400}.r{text-align:right}th.r{text-align:right}
.tot{background:#0a0d14;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:3.5mm 4mm;margin-bottom:3mm}
.tot span{font-size:7.5pt;letter-spacing:.28em;text-transform:uppercase}.tot b{font-size:14pt;font-weight:400}
.nota{font-size:7.8pt;line-height:1.55;color:#8a90a0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.cover{flex:1;display:flex;flex-direction:column;padding:16mm 18mm;background-image:repeating-linear-gradient(115deg,rgba(255,255,255,.03) 0 1px,transparent 1px 42px)}
.cover .lg{height:16mm;width:auto;align-self:flex-start}
.cover h1{margin:78mm 0 0;font-weight:300;font-size:36pt;line-height:1.15;color:#fff}.cover h1 span{color:#aab0bd;display:block}
.cover hr{width:34mm;border:0;border-top:1px solid #4a5060;margin:9mm 0 0}
.meta{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:5mm 12mm}
.meta div{border-bottom:1px solid #2c3140;padding-bottom:2mm}.meta small{display:block;font-size:5.8pt;letter-spacing:.3em;color:#7c8391;text-transform:uppercase;margin-bottom:1mm}.meta span{font-size:9.5pt;color:#fff}
.k{font-size:6pt;letter-spacing:.3em;color:#9aa0ad;text-transform:uppercase}
.info{display:grid;grid-template-columns:1fr 1fr;gap:3mm 10mm;margin-bottom:2mm}.info div{border-bottom:1px solid #e6e8ee;padding-bottom:1.5mm}.info small{display:block;font-size:5.8pt;letter-spacing:.3em;color:#9aa0ad;text-transform:uppercase}.info span{font-size:9.5pt;color:#0a0d14}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:14mm;margin-top:18mm}.sign div{border-top:1px solid #0a0d14;padding-top:2mm;font-size:9pt;color:#0a0d14}.sign small{display:block;font-size:6.5pt;letter-spacing:.2em;color:#9aa0ad;text-transform:uppercase;margin-top:1mm}
.simp .sec{margin:4.5mm 0 3mm;padding-bottom:2mm}.simp .sec .n{font-size:16pt}.simp td{padding:1.9mm 3mm}.simp th{padding:2mm 3mm}.simp p{margin-bottom:2mm}.simp .b{margin:.8mm 0}
.simp .sign{margin-top:9mm}.simp .tot{padding:2.6mm 4mm}.simp .info{margin-bottom:0}.simp .hdr2{padding:6mm 14mm}.simp .hdr2 .lg{height:11mm}
.hdr2{background:#0a0d14;background-image:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 1px,transparent 1px 38px);color:#fff;display:flex;justify-content:space-between;align-items:center;padding:8mm 14mm}
.hdr2 .lg{height:13mm;width:auto}.hdr2 h2{margin:0;font-weight:300;font-size:20pt}.hdr2 small{display:block;text-align:right;font-size:5.8pt;letter-spacing:.3em;color:#7c8391;margin-top:2mm}
`;
  const pg=(n,total_pg,content)=>'<div class="page"><div class="band">'+LOGO_SVG(80).replace('<svg ','<svg ')+'<span class="r">Proposta comercial · '+esc(p.numero)+'</span></div><div class="body">'+content+'</div>'+
    '<div class="foot"><span>'+esc(brand)+' · Ambientes inteligentes</span><span>'+n+' / '+total_pg+'</span></div></div>';
  const assin=(extra)=>'<div class="sign"><div>'+esc(nomeCli)+'<small>Cliente'+(cl.documento?' · '+esc(cl.documento):'')+'</small></div><div>'+esc(p.resp_nome||brand)+'<small>'+esc(brand)+(emp.cnpj?' · CNPJ '+esc(emp.cnpj):'')+'</small></div></div>';
  let body='';
  if(comp){
    const fr=FRENTES.filter(f=>T.linhas.find(x=>x.nome===f.nome).n);
    const amb=linhas(p.ambientes).map(l=>l.split('|').map(x=>x.trim()));
    const fases=PROP_PADRAO.fases;
    const cover='<div class="page dark"><div class="cover">'+LOGO_SVG(190)+'<h1>Proposta<span>Comercial</span></h1><hr><div class="meta">'+
      '<div><small>Proposta nº</small><span>'+esc(p.numero)+'</span></div><div><small>Cliente</small><span>'+esc(nomeCli)+'</span></div>'+
      '<div><small>Projeto</small><span>'+esc(proj)+'</span></div><div><small>Data</small><span>'+dtx(p.data)+'</span></div>'+
      '<div><small>Validade</small><span>'+esc(p.validade_dias)+' dias corridos</span></div><div style="border:0"></div></div>'+
      '<div class="k" style="margin-top:9mm;color:#555b69">Documento confidencial · uso exclusivo do cliente</div></div></div>';
    const p2=pg(2,6,sec('01','Apresentação')+'<p><b style="font-weight:400;color:#0a0d14">'+esc(nomeCli)+'</b>, obrigado pela oportunidade de apresentar esta proposta.</p>'+
      '<p>A '+esc(brand)+' projeta, instala e mantém sistemas inteligentes para residências e edifícios de alto padrão. Reunimos automação, áudio e vídeo, energia e segurança em uma única infraestrutura — uma rede, um painel, um responsável. Isso elimina o empurra-empurra entre fornecedores e garante que o sistema continue funcionando muito depois da obra terminar.</p>'+
      '<p>Esta proposta detalha o escopo técnico, o investimento, o cronograma e as condições comerciais para o projeto <b style="font-weight:400;color:#0a0d14">'+esc(proj)+'</b>.</p>'+
      sec('02','Entendimento da demanda')+'<p>'+(p.visita_data?'Com base na visita técnica realizada em '+dtx(p.visita_data)+' e nos projetos recebidos, identificamos':'Com base no levantamento realizado, identificamos')+' as seguintes necessidades:</p>'+lista(p.demanda)+
      (p.premissa_projeto?'<p style="margin-top:3mm"><b style="font-weight:400;color:#0a0d14">Premissa de projeto:</b> '+esc(p.premissa_projeto)+'</p>':'')+
      sec('03','Solução proposta')+'<p>A solução foi organizada nas frentes da '+esc(brand)+'. Cada frente pode ser contratada isoladamente ou em conjunto'+(desc>0?' — o desconto de escala está no item 06':'')+'.</p>'+
      tb([{l:'Frente',s:1},{l:'Categoria'},{l:'O que entrega'},{l:'Dimensionamento'}],fr.map(f=>[esc(f.nome),esc(f.cat),esc(f.entrega),esc(p['dim_'+f.k]||T.linhas.find(x=>x.nome===f.nome).n+' itens')])));
    const p3=pg(3,6,(amb.length?'<div class="sub">Detalhamento por ambiente</div>'+tb([{l:'Ambiente',s:1},{l:'Sistemas previstos'},{l:'Observações'}],amb.map(r=>[esc(r[0]||''),esc(r[1]||''),esc(r[2]||'—')])):'')+
      sec('04','Escopo de fornecimento')+'<div class="two"><div><div class="sub" style="margin-top:0">Está incluído</div>'+lista(p.incluso)+'</div><div><div class="sub" style="margin-top:0">Não está incluído</div>'+lista(p.nao_incluso)+'</div></div>'+
      sec('05','Cronograma de execução')+tb([{l:'Fase',w:'14mm'},{l:'Etapa',s:1},{l:'Entregas'},{l:'Prazo',r:1}],fases.map((f,i)=>[String(i+1).padStart(2,'0'),esc(f[0]),esc(f[1]),Number(p['prazo_'+(i+1)])?esc(p['prazo_'+(i+1)])+' dias úteis':'a definir'])));
    const planos=[['Essencial','Suporte remoto em horário comercial · atualizações',p.plano_essencial],['Avançado','Essencial + 2 visitas preventivas/ano · SLA 24h',p.plano_avancado],['Total','Avançado + monitoramento ativo · SLA 4h · peças',p.plano_total]];
    const p4=pg(4,6,sec('06','Investimento')+tb([{l:'Frente',s:1,w:'42mm'},{l:'Descrição'},{l:'Valor',r:1}],inv.map(r=>[r[0],r[1],r[2]]))+
      '<div class="tot"><span>Investimento total</span><b>'+money2(total)+'</b></div><div class="sub">Condições de pagamento</div>'+tb([{l:'Parcela',s:1,w:'62mm'},{l:'Condição'}],parc)+
      '<p class="nota">'+esc(p.cambial||'')+'</p>'+
      sec('07','Pós-obra — ATIVE SERVICE')+'<p>Sistema inteligente sem manutenção vira sistema desligado. Os planos abaixo são contratados à parte e podem começar junto com a entrega.</p>'+
      tb([{l:'Plano',s:1,w:'30mm'},{l:'O que inclui'},{l:'Mensalidade',r:1}],planos.map(a=>[a[0],esc(a[1]),Number(a[2])?money2(a[2]):'sob consulta'])));
    const p5=pg(5,6,sec('08','Premissas e responsabilidades do cliente')+lista(p.premissas)+
      '<p class="nota" style="margin-top:3mm">Atrasos causados por pendências de obra ou de terceiros suspendem o cronograma e podem gerar custo de remobilização de equipe.</p>'+
      sec('09','Garantia')+tb([{l:'Item',s:1,w:'62mm'},{l:'Cobertura'}],[['Instalação e programação',esc(p.garantia_instal)],['Equipamentos',esc(p.garantia_equip)],['Atendimento em garantia',esc(p.garantia_atend)],['Exclusões',esc(p.garantia_excl)]])+
      sec('10','Condições comerciais')+lista(String(p.condicoes||'').replace(/\{validade\}/g,p.validade_dias)));
    const p6=pg(6,6,sec('11','Aceite')+'<p>Ao assinar abaixo, o cliente declara ter lido e concordado com o escopo, os valores, os prazos e as condições desta proposta.</p><p style="margin-top:12mm">Local e data: ________________________________</p>'+assin()+
      '<div style="margin-top:50mm;text-align:center;opacity:.9"><div style="display:inline-block;background:#0a0d14;padding:6mm 10mm">'+LOGO_SVG(110)+'</div><div class="k" style="margin-top:3mm">Ambientes inteligentes</div></div>');
    body=cover+p2+p3+p4+p5+p6;
  }else{
    const esc_l=linhas(p.escopo_simp);
    const rows=inv.map(r=>[r[0],r[2]]);
    body='<div class="page simp"><div class="hdr2">'+LOGO_SVG(110)+'<div><h2>Proposta comercial</h2><small>AMBIENTES INTELIGENTES</small></div></div><div class="body" style="padding-top:6mm">'+
      '<div class="info"><div><small>Proposta nº</small><span>'+esc(p.numero)+'</span></div><div><small>Data</small><span>'+dtx(p.data)+'</span></div>'+
      '<div><small>Cliente</small><span>'+esc(nomeCli)+'</span></div><div><small>Contato</small><span>'+esc(p.contato||'—')+'</span></div>'+
      '<div><small>Projeto</small><span>'+esc(proj)+'</span></div><div><small>Validade</small><span>'+esc(p.validade_dias)+' dias corridos</span></div></div>'+
      sec('01','Escopo')+'<p>Fornecimento, instalação, programação e entrega dos sistemas abaixo:</p>'+esc_l.map(x=>'<div class="b">'+esc(x)+'</div>').join('')+
      '<p class="nota" style="margin-top:3mm">Inclui projeto executivo, comissionamento, treinamento de uso e documentação as-built. Não inclui infraestrutura civil, quadros elétricos, alvenaria, marcenaria e link de internet.</p>'+
      sec('02','Investimento')+tb([{l:'Item',s:1},{l:'Valor',r:1}],rows)+'<div class="tot"><span>Investimento total</span><b>'+money2(total)+'</b></div>'+
      sec('03','Condições')+tb([{l:'Item',s:1,w:'34mm'},{l:'Condição'}],[
        ['Pagamento',esc([p.pag_1,p.pag_2,p.pag_3].every(x=>Number(x)>0)?p.pag_1+'% na assinatura · '+p.pag_2+'% no início da instalação · '+p.pag_3+'% na entrega':'Conforme condições combinadas')+esc(cartao)],
        ['Prazo',Number(p.prazo_1)?esc(p.prazo_1)+' dias úteis após liberação da obra e aprovação desta proposta':'A definir após liberação da obra e aprovação desta proposta'],
        ['Garantia',esc(String(p.garantia_instal||'12 meses').replace(/ a partir do aceite/,''))+' de instalação · equipamentos conforme fabricante'],
        ['Pós-obra',Number(p.plano_essencial)?'Planos ATIVE SERVICE a partir de '+money2(p.plano_essencial)+'/mês (à parte)':'Planos ATIVE SERVICE sob consulta (à parte)']])+
      '<div class="sub">Aceite</div><div class="sign" style="margin-top:12mm"><div>'+esc(nomeCli)+'<small>Cliente</small></div><div>'+esc(p.resp_nome||brand)+'<small>'+esc(brand)+'</small></div></div>'+
      '</div><div class="foot"><span>'+esc(contatoEmp)+'</span><span>Documento confidencial</span></div></div>';
  }
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposta '+esc(p.numero)+' · '+esc(nomeCli)+'</title><style>'+css+'</style></head><body>'+body+'</body></html>';
}
