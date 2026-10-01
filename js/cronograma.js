/* ---------- linha do tempo de execução dos projetos, por etapa ---------- */
let obrasVista='lista';
const dtv=s=>new Date(s+'T12:00:00').getTime();
const MESES_C=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

// datas planejadas de cada etapa: as informadas à mão, ou distribuídas entre o início e o fim previsto do projeto conforme o peso
function etapasComDatas(o){
  const E=o.etapas||[];if(!E.length)return[];
  let ini=o.inicio||hoje(),fim=o.fim_prev||addDias(ini,45);
  if(dtv(fim)<=dtv(ini))fim=addDias(ini,Math.max(14,E.length*7));
  const pesos=E.map(e=>Math.max(Number(e.pct||0),4)),tot=pesos.reduce((a,b)=>a+b,0),span=Math.max(E.length,difDias(fim,ini));
  let acc=0,achou=false;const h=hoje();
  return E.map((e,i)=>{
    const pi=Math.round(acc/tot*span);acc+=pesos[i];const pf=Math.max(pi+1,Math.round(acc/tot*span));
    const i2=e.ini||addDias(ini,pi);let f2=e.fim||addDias(ini,pf);if(dtv(f2)<dtv(i2))f2=i2;
    const concl=e.status==='Concluída',atual=!concl&&!achou;if(!concl)achou=true;
    return{idx:i,nome:e.nome,pct:Number(e.pct||0),status:e.status,ini:i2,fim:f2,concluida:e.concluida||'',manual:!!(e.ini||e.fim),
      atual:atual,atraso:!concl&&f2<h,classe:concl?'g-done':(!concl&&f2<h)?'g-late':atual?'g-now':'g-wait'};
  });
}
function ganttHtml(linhas,opt){
  opt=opt||{};
  if(!linhas.length)return '<div class="empty">Nada para mostrar na linha do tempo.</div>';
  const h=hoje();let min=Infinity,max=-Infinity;
  linhas.forEach(l=>l.barras.forEach(b=>{min=Math.min(min,dtv(b.ini));max=Math.max(max,dtv(b.fim))}));
  const th=dtv(h);if(th>=min-30*864e5&&th<=max+30*864e5){min=Math.min(min,th);max=Math.max(max,th)}
  min-=2*864e5;max+=3*864e5;
  const total=(max-min)/864e5,pos=t=>(t-min)/864e5/total*100;
  const ticks=[];
  if(total<=70){for(let t=min;t<=max;t+=7*864e5){const d=new Date(t);ticks.push({p:pos(t),l:String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')})}}
  else{const d=new Date(min);d.setDate(1);d.setMonth(d.getMonth()+1);
    while(d.getTime()<=max){ticks.push({p:pos(d.getTime()),l:MESES_C[d.getMonth()]+'/'+String(d.getFullYear()).slice(2)});d.setMonth(d.getMonth()+(total>400?3:1))}}
  const grade=ticks.map(t=>'<i class="g-grid" style="left:'+t.p.toFixed(2)+'%"></i>').join('');
  const hoje_=th>=min&&th<=max?'<i class="g-today" style="left:'+pos(th).toFixed(2)+'%"><b>hoje</b></i>':'';
  let out='<div class="gantt-leg"><span><i class="lg g-done"></i>Concluída</span><span><i class="lg g-now"></i>Em andamento</span><span><i class="lg g-late"></i>Atrasada</span><span><i class="lg g-wait"></i>Pendente</span><span><i class="lg-t"></i>Hoje</span></div>';
  out+='<div class="scr"><div class="gantt" style="min-width:'+(opt.largura||820)+'px"><div class="g-row g-head"><div class="g-lab"></div><div class="g-track g-axis">'+hoje_+
    ticks.map(t=>'<span style="left:'+t.p.toFixed(2)+'%">'+t.l+'</span>').join('')+'</div></div>';
  linhas.forEach(l=>{
    out+='<div class="g-row'+(l.id?' clk':'')+'"'+(l.id?' data-gid="'+l.id+'"':'')+'><div class="g-lab">'+l.rotulo+'</div><div class="g-track">'+grade+hoje_+
      l.barras.map(b=>{const left=pos(dtv(b.ini)),w=Math.max(1.1,pos(dtv(b.fim)+864e5)-left);
        return '<div class="g-bar '+b.classe+'" style="left:'+left.toFixed(2)+'%;width:'+w.toFixed(2)+'%" title="'+esc(b.title||'')+'"><span>'+esc(b.txt||'')+'</span></div>'}).join('')+
      (l.marcas||[]).map(m=>'<i class="g-mark" style="left:'+pos(dtv(m.data)+432e5).toFixed(2)+'%" title="'+esc(m.title||'')+'"></i>').join('')+'</div></div>';
  });
  return out+'</div></div>';
}
const tipEtapa=e=>e.nome+' · '+dBR(e.ini)+' → '+dBR(e.fim)+' · '+e.status+(e.concluida?' em '+dBR(e.concluida):'')+(e.atraso?' · atrasada':'');

/* visão geral: um projeto por linha, com as etapas em sequência */
function ganttObras(rows){
  const linhas=rows.filter(o=>(o.etapas||[]).length).map(o=>{
    const E=etapasComDatas(o),p=progressoObra(o);
    return{id:o.id,rotulo:'<div class="g-t"><b>'+esc(o.codigo)+'</b> <span class="bg '+bgFor(o.status)+'">'+esc(o.status)+'</span></div><div class="g-s">'+esc(nm('clientes',o.cliente))+(o.titulo?' · '+esc(o.titulo):'')+
      '</div><div class="bar'+(p<40?' b':p<70?' w':'')+'" style="margin-top:4px"><i style="width:'+p+'%"></i></div>',
      barras:E.map(e=>({ini:e.ini,fim:e.fim,classe:e.classe,txt:e.nome,title:tipEtapa(e)})),
      marcas:E.filter(e=>e.concluida).map(e=>({data:e.concluida,title:'Concluída em '+dBR(e.concluida)+' · '+e.nome}))};
  });
  const sem=rows.length-linhas.length;
  return ganttHtml(linhas,{largura:900})+(sem?'<div class="note">'+sem+' projeto(s) sem etapas não aparecem na linha do tempo.</div>':'')+
    '<div class="note">Passe o mouse sobre uma etapa para ver as datas. As datas planejadas vêm do início e do fim previsto do projeto, distribuídas pelo peso de cada etapa. Ajuste cada etapa no projeto, aba Cronograma.</div>';
}
function wireGanttObras(el){el.querySelectorAll('[data-gid]').forEach(r=>r.onclick=()=>abrirObra(r.dataset.gid))}

/* dentro do projeto: uma etapa por linha, com datas editáveis */
function cronogramaObraHtml(o){
  const E=etapasComDatas(o);
  if(!E.length)return '<div class="empty">Este projeto ainda não tem etapas.</div>';
  const linhas=E.map(e=>({rotulo:'<div class="g-t"><b>'+(e.idx+1)+'. '+esc(e.nome)+'</b></div><div class="g-s">'+esc(e.status)+(e.atraso?' · atrasada':'')+'</div>',
    barras:[{ini:e.ini,fim:e.fim,classe:e.classe,txt:dBR(e.ini)+' → '+dBR(e.fim),title:tipEtapa(e)}],
    marcas:e.concluida?[{data:e.concluida,title:'Concluída em '+dBR(e.concluida)}]:[]}));
  const concl=E.filter(e=>e.status==='Concluída').length,atras=E.filter(e=>e.atraso).length;
  const inicio=E.reduce((a,e)=>e.ini<a?e.ini:a,E[0].ini),fim=E.reduce((a,e)=>e.fim>a?e.fim:a,E[0].fim);
  let h='<div class="kpis" style="margin-bottom:10px">'+kpi('Etapas concluídas',concl+' de '+E.length,progressoObra(o)+'% de progresso')+kpi('Janela planejada',dBR(inicio)+' → '+dBR(fim),difDias(fim,inicio)+' dias')+
    kpi('Etapas atrasadas',atras,atras?'prazo planejado vencido':'dentro do prazo')+'</div>'+ganttHtml(linhas,{largura:640});
  h+='<div class="fsec" style="margin-top:14px">Datas de cada etapa</div><div class="scr"><table><thead><tr><th>Etapa</th><th>Início</th><th>Fim</th><th>Concluída em</th><th></th></tr></thead><tbody>'+
    E.map(e=>'<tr><td class="s">'+esc(e.nome)+(e.manual?'':' <span class="bg g-gray">automática</span>')+'</td>'+
      '<td><input type="date" data-ci="'+e.idx+'" data-cf="ini" value="'+e.ini+'" style="width:150px"></td>'+
      '<td><input type="date" data-ci="'+e.idx+'" data-cf="fim" value="'+e.fim+'" style="width:150px"></td>'+
      '<td>'+(e.concluida?dBR(e.concluida):'—')+'</td><td class="n">'+(e.status!=='Concluída'?'<button class="btn sec sm" data-cc="'+esc(e.nome)+'">Concluir</button>':'')+'</td></tr>').join('')+'</tbody></table></div>'+
    '<div style="margin-top:10px"><button class="btn sec sm" id="cRe">Recalcular datas automáticas</button></div>'+
    '<div class="note">As datas automáticas distribuem as etapas entre o início e o fim previsto do projeto, conforme o peso de cada uma. Ao alterar uma data, a etapa passa a ter data própria.</div>';
  return h;
}
function wireCronogramaObra(tb,o,draw){
  tb.querySelectorAll('[data-ci]').forEach(inp=>inp.onchange=()=>{
    const e=o.etapas[Number(inp.dataset.ci)],E=etapasComDatas(o)[Number(inp.dataset.ci)];
    const ini=inp.dataset.cf==='ini'?inp.value:E.ini,fim=inp.dataset.cf==='fim'?inp.value:E.fim;
    if(!ini||!fim){draw();return}
    if(fim<ini){toast('O fim não pode ser antes do início');draw();return}
    e.ini=ini;e.fim=fim;put('obras',o);draw();
  });
  tb.querySelectorAll('[data-cc]').forEach(b=>b.onclick=()=>concluirEtapa(o,b.dataset.cc,draw));
  const re=tb.querySelector('#cRe');
  if(re)re.onclick=async()=>{if(await ask('Voltar todas as etapas para as datas automáticas? As datas que você ajustou serão apagadas.','Recalcular')){
    o.etapas.forEach(e=>{delete e.ini;delete e.fim});put('obras',o);toast('Datas recalculadas');draw()}};
}
