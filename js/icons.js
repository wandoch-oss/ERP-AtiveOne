/* ---------- ícones (traço, 24x24) e decoração automática de botões ---------- */
const ICONES={
 dashboard:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.2c2.4.3 4 2.3 4 4.8"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
 funnel:'<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
 filetext:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
 contract:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M8 17c1-2.4 2-2.4 2 0s1 1.6 3-.8"/>',
 checkc:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
 xc:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
 megaphone:'<path d="M3 10v4a1 1 0 0 0 1 1h3l8 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M19 9c1.2 1 1.2 5 0 6"/>',
 share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
 chart:'<path d="M5 20V11M11 20V4M17 20v-6"/><path d="M3 21h18"/>',
 link:'<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 chev:'<path d="M9 6l6 6-6 6"/>',
 lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 eyeoff:'<path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.6 7 10 7c1.5 0 2.8-.4 4-.9"/>',
 building:'<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16"/><path d="M14 10h5a1 1 0 0 1 1 1v10"/><path d="M8 8h2M8 12h2M8 16h2M3 21h18"/>',
 wrench:'<path d="M15 5a4 4 0 0 0-4.6 5.4L3.5 17.3a1.8 1.8 0 0 0 2.5 2.5l6.9-6.9A4 4 0 0 0 18.3 8.5l-2.4 2.4-2.3-.5-.5-2.3z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2.4 11h10.4L21 8H7"/>',
 box:'<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
 dollar:'<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.4-1-1.5-1.7-2.8-1.7-1.6 0-2.8.9-2.8 2.1 0 3 5.8 1.4 5.8 4.3 0 1.2-1.3 2.1-3 2.1-1.4 0-2.6-.7-3-1.8M12 6v1.5M12 16.5V18"/>',
 bank:'<path d="M3 10l9-6 9 6"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18"/>',
 swap:'<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
 trend:'<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
 pie:'<path d="M12 3v9h9"/><path d="M20.5 15A9 9 0 1 1 9 3.5"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 userplus:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7"/><path d="M19 8v6M16 11h6"/>',
 truck:'<path d="M2 6h11v10H2zM13 9h4l4 3v4h-8"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
 edit:'<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 8l3 3"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 save:'<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
 download:'<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
 upload:'<path d="M12 16V5M7 9l5-5 5 5M4 20h16"/>',
 printer:'<path d="M7 9V3h10v6M7 17H4v-6h16v6h-3M7 14h10v7H7z"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 undo:'<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
 back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
 tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
 alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
 inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
 zap:'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
 sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'
};
function ic(nome,tam){
  const d=ICONES[nome];if(!d)return '';
  tam=tam||16;
  return '<svg class="ico" viewBox="0 0 24 24" width="'+tam+'" height="'+tam+'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
}
const NAV_IC={painel:'dashboard',acessos:'lock',clientes:'users',oportunidades:'funnel',orcamentos:'filetext',vendas:'checkc',marketing:'chart',campanhas:'megaphone',
  canais:'share',parcerias:'link',concorrentes:'eye',obras:'building',os:'wrench',agenda:'calendar',estoque:'box',compras:'cart',financeiro:'dollar',
  bancos:'bank',conciliacao:'swap',fluxo:'trend',dre:'pie',dre_contabil:'pie',contratos:'contract',cadastros:'settings'};
const TAB_IC={'Empresas':'building','Financeiro':'dollar','Produtos':'box','Serviços':'wrench','Pessoas':'users','Compras':'cart'};
function iconeKpi(l){
  l=String(l||'').toLowerCase();
  if(/vencid|atenção|atras|abaixo|alerta/.test(l))return 'alert';
  if(/projeto|obra/.test(l))return 'building';
  if(/oportunidade|funil|lead|convers|taxa/.test(l))return 'funnel';
  if(/contrato|assinad/.test(l))return 'contract';
  if(/cliente|parceir|pessoa|equipe|indica/.test(l))return 'users';
  if(/\bos\b|ordens|atendiment|técnic/.test(l))return 'wrench';
  if(/estoque|itens|produto|material/.test(l))return 'box';
  if(/margem|resultado|lucro|ebit/.test(l))return 'trend';
  if(/receita|venda|receber|faturament|investiment|saldo|valor|custo|pagar|despesa|comiss|caixa/.test(l))return 'dollar';
  if(/orçament|proposta/.test(l))return 'filetext';
  if(/campanha/.test(l))return 'megaphone';
  return 'chart';
}
const BTN_IC=[
  [/^editar/i,'edit'],[/^(excluir|apagar|remover)/i,'trash'],[/^marcar como perdido/i,'xc'],[/^(cancelar|fechar|não)/i,'x'],
  [/^(salvar)/i,'save'],[/^(importar|anexar|enviar)/i,'upload'],[/^(baixar|exportar|carregar)/i,'download'],[/^imprimir/i,'printer'],
  [/^(visualizar|ver )/i,'eye'],[/^gerar/i,'filetext'],[/^(converter|reabrir|reativar)/i,'refresh'],[/^desfazer/i,'undo'],[/^ignorar/i,'eyeoff'],
  [/^escolher/i,'list'],[/^classificar/i,'tag'],[/^transferir/i,'swap'],[/^voltar/i,'back'],
  [/^(liquidar|conciliar|registrar|confirmar|concluir|aprovar|emitir|criar|adicionar|baixar material)/i,'check']
];
const NOVO_IC=[[/cliente/i,'userplus'],[/colaborador|pessoa/i,'userplus'],[/oportunidade/i,'funnel'],[/or[cç]amento/i,'filetext'],[/venda/i,'checkc'],
  [/ordem de servi|^(nova )?os$/i,'wrench'],[/servi[cç]o/i,'wrench'],[/lan[cç]amento/i,'dollar'],[/projeto/i,'building'],[/contrato/i,'contract'],
  [/parceiro/i,'link'],[/produto|local|kit/i,'box'],[/empresa/i,'building'],[/conta banc/i,'bank'],[/conta/i,'list'],[/fornecedor/i,'truck'],
  [/concorrente/i,'eye'],[/campanha/i,'megaphone'],[/canal/i,'share'],[/compromisso|agenda/i,'calendar'],[/pedido|compra/i,'cart'],
  [/fam[ií]lia|categoria/i,'tag'],[/centro/i,'target']];
function iconeNovo(t){for(const r of NOVO_IC)if(r[0].test(t))return r[1];return 'plus'}
function ehNovo(txt){return /^\+/.test(txt)||/^(novo|nova)\s/i.test(txt)}
function iconeBotao(txt){
  const t=txt.replace(/^\+\s*/,'');
  if(/^\+/.test(txt)||/^(novo|nova|adicionar)/i.test(t))return 'plus';
  for(const r of BTN_IC)if(r[0].test(t))return r[1];
  return '';
}
function decorarIcones(raiz){
  (raiz||document).querySelectorAll('.btn:not([data-ic])').forEach(b=>{
    b.dataset.ic='1';
    if(b.childElementCount)return;
    const txt=b.textContent.trim();
    if(!txt)return;
    if(txt==='×'){b.innerHTML=ic('x',14);b.setAttribute('aria-label','Remover');return}
    const rot=txt.replace(/^\+\s*/,'').replace(/</g,'&lt;');
    if(ehNovo(txt)&&!b.classList.contains('sec')&&!b.classList.contains('sm')){
      b.innerHTML='<span class="bi">'+ic(iconeNovo(rot),17)+'</span><span>'+rot+'</span>';b.classList.add('ibtn','ibig');return;
    }
    const nome=iconeBotao(txt);if(!nome)return;
    b.innerHTML=ic(nome,b.classList.contains('sm')?13:15)+'<span>'+rot+'</span>';
    b.classList.add('ibtn');
  });
  (raiz||document).querySelectorAll('.tabs .tab:not([data-ic])').forEach(b=>{
    b.dataset.ic='1';
    const nome=TAB_IC[b.textContent.trim()];
    if(nome&&!b.childElementCount)b.innerHTML=ic(nome,15)+'<span>'+b.textContent+'</span>';
  });
}
let _decRaf=0;
new MutationObserver(()=>{if(_decRaf)return;_decRaf=requestAnimationFrame(()=>{_decRaf=0;decorarIcones()})}).observe(document.documentElement,{childList:true,subtree:true});
