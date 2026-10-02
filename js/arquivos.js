/* ---------- arquivos do projeto: plantas e projetos de arquitetura e engenharia ---------- */
const CAT_ARQ=['Arquitetura','Interiores','Elétrica','Luminotécnico','Estrutural','Hidráulica','Climatização','Automação (nosso projeto)','Fotos da obra','Outros'];
let arqFiltro='';
function iconeArq(d){
  if(/^image\//.test(d.contentType||''))return '<img src="'+esc(urlDoc(d))+'" alt="" loading="lazy">';
  return '<span class="aq-pdf">PDF</span>';
}
function arquivosObraHtml(o){
  const L=(o.arquivos||[]).slice().sort((a,b)=>String(b.enviado_em).localeCompare(String(a.enviado_em)));
  const cats=CAT_ARQ.filter(c=>L.some(d=>d.categoria===c));
  if(arqFiltro&&!cats.includes(arqFiltro))arqFiltro='';
  const vis=L.filter(d=>!arqFiltro||d.categoria===arqFiltro);
  let h='<div class="aq-up"><div class="frow"><label class="f"><span>Tipo de arquivo</span><select id="aqCat">'+CAT_ARQ.map(c=>'<option>'+esc(c)+'</option>').join('')+'</select></label>'+
    '<label class="f"><span>Descrição ou revisão (opcional)</span><input type="text" id="aqDesc" placeholder="Ex.: Planta baixa · R02"></label></div>'+
    '<div class="drop" id="aqDrop">Clique aqui ou arraste os arquivos (PDF ou imagem, até 20 MB cada)<br><span style="font-size:11px">Pode enviar vários de uma vez. Arquivos DWG precisam ser salvos em PDF.</span></div>'+
    '<input type="file" id="aqF" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple style="display:none"><div class="note" id="aqMsg"></div></div>';
  h+='<div class="aq-head"><b>'+L.length+' arquivo(s)</b>'+(cats.length>1?'<div class="aq-chips"><button class="'+(arqFiltro?'':'on')+'" data-aqf="">Todos</button>'+
    cats.map(c=>'<button class="'+(arqFiltro===c?'on':'')+'" data-aqf="'+esc(c)+'">'+esc(c)+' · '+L.filter(d=>d.categoria===c).length+'</button>').join('')+'</div>':'')+'</div>';
  h+=vis.length?'<div class="aq-grid">'+vis.map(d=>'<div class="aq-card"><a class="aq-thumb" href="'+esc(urlDoc(d))+'" target="_blank" rel="noopener">'+iconeArq(d)+'</a>'+
    '<div class="aq-info"><b title="'+esc(d.nome)+'">'+esc(d.nome)+'</b><span class="bg g-accent">'+esc(d.categoria||'Outros')+'</span>'+
    (d.descricao?'<small>'+esc(d.descricao)+'</small>':'')+'<small>'+dBR(d.enviado_em)+' · '+tamanho(d.tamanho||0)+'</small></div>'+
    '<div class="aq-act"><a class="btn sec sm" href="'+esc(urlDoc(d))+'" target="_blank" rel="noopener" style="text-decoration:none">Abrir</a>'+
    '<button class="btn sec sm" data-aqe="'+d.id+'">Editar</button><button class="btn dgr sm" data-aqr="'+d.id+'">Remover</button></div></div>').join('')+'</div>'
    :'<div class="empty">Nenhum arquivo anexado a este projeto. Envie as plantas e os projetos de arquitetura e engenharia para consulta da equipe.</div>';
  return h;
}
function wireArquivosObra(tb,o,draw){
  const fx=tb.querySelector('#aqF'),drop=tb.querySelector('#aqDrop'),msg=tb.querySelector('#aqMsg');
  const enviar=async files=>{
    files=[...(files||[])];if(!files.length)return;
    const cat=tb.querySelector('#aqCat').value,desc=tb.querySelector('#aqDesc').value.trim();
    let ok=0;const erros=[];
    for(let i=0;i<files.length;i++){
      const f=files[i];msg.textContent='Enviando '+(i+1)+' de '+files.length+': '+f.name+'…';
      try{const r=await subirArquivo(f,'obras/'+o.id);o.arquivos=(o.arquivos||[]).concat([Object.assign({id:uid(),nome:f.name,categoria:cat,descricao:desc,enviado_em:hoje()},r)]);put('obras',o);ok++}
      catch(e){erros.push(f.name+': '+erroUpload(e))}
    }
    if(ok)toast(ok+' arquivo(s) anexado(s)');
    draw();
    if(erros.length){const m=document.getElementById('aqMsg');if(m){m.style.color='var(--red)';m.textContent=erros.join(' · ')}}
  };
  drop.onclick=()=>fx.click();
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('hot')};
  drop.ondragleave=()=>drop.classList.remove('hot');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('hot');enviar(e.dataTransfer.files)};
  fx.onchange=()=>enviar(fx.files);
  tb.querySelectorAll('[data-aqf]').forEach(b=>b.onclick=()=>{arqFiltro=b.dataset.aqf;draw()});
  tb.querySelectorAll('[data-aqr]').forEach(b=>b.onclick=async()=>{
    const d=(o.arquivos||[]).find(x=>x.id===b.dataset.aqr);
    if(!d||!await ask('Remover "'+d.nome+'" do projeto? O arquivo será apagado.','Remover'))return;
    await removerArquivo(d);o.arquivos=o.arquivos.filter(x=>x.id!==d.id);put('obras',o);toast('Arquivo removido');draw();
  });
  tb.querySelectorAll('[data-aqe]').forEach(b=>b.onclick=()=>{
    const d=(o.arquivos||[]).find(x=>x.id===b.dataset.aqe);if(!d)return;
    const box=b.closest('.aq-card');
    box.querySelector('.aq-info').innerHTML='<select class="aqC">'+CAT_ARQ.map(c=>'<option'+(c===d.categoria?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<input type="text" class="aqD" value="'+esc(d.descricao||'')+'" placeholder="Descrição ou revisão">';
    b.outerHTML='<button class="btn sm" data-aqs="1">Salvar</button>';
    box.querySelector('[data-aqs]').onclick=()=>{d.categoria=box.querySelector('.aqC').value;d.descricao=box.querySelector('.aqD').value.trim();put('obras',o);toast('Arquivo atualizado');draw()};
  });
}
