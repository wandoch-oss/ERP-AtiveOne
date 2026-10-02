/* ---------- acessos: perfis de usuário e o que cada um enxerga ---------- */
const PERFIS={
  'Administrador':{d:'Acessa tudo, inclusive Painel, Cadastros e Acessos.',g:'*',cor:'g-accent'},
  'Comercial':{d:'Marketing e Comercial.',g:['Marketing','Comercial'],cor:'g-green'},
  'Operação':{d:'Projetos, ordens de serviço e agenda.',g:['Operação'],cor:'g-amber'},
  'Financeiro':{d:'Compras, Financeiro e Contratos.',g:['Compras','Financeiro','Gestão'],cor:'g-purple'},
  'Técnico':{d:'Somente as ordens de serviço em que ele é o técnico.',r:['os'],cor:'g-gray'}
};
const NOMES_PERFIS=Object.keys(PERFIS);
// sem login (navegador ou artefato) todos são administradores; "ver como" serve para testar outro perfil
let VER_COMO=null;try{VER_COMO=JSON.parse(sessionStorage.getItem('ao-ver-como')||'null')}catch(e){}
const normEmail=s=>String(s||'').trim().toLowerCase();

function rotasDoPerfil(p){
  const P=PERFIS[p];if(!P)return [];
  if(P.g==='*')return NAV.flatMap(g=>g.i.map(i=>i[0]));
  if(P.r)return P.r.slice();
  return NAV.filter(g=>P.g.includes(g.g)).flatMap(g=>g.i.map(i=>i[0]));
}
function meuUsuario(){
  if(MODE==='supabase')return SB_USER?S.usuarios.find(u=>normEmail(u.email)===normEmail(SB_USER.email))||null:null;
  return VER_COMO;
}
function perfilAtual(){
  const u=meuUsuario();
  if(MODE==='supabase'){
    if(u)return ativo(u)&&PERFIS[u.perfil]?u.perfil:null;
    return ORG_PAPEL==='admin'?'Administrador':null;   // quem criou a empresa entra como administrador
  }
  return (u&&PERFIS[u.perfil])?u.perfil:'Administrador';
}
const ehAdmin=()=>perfilAtual()==='Administrador';
function podeRota(k){
  if(k==='sem_acesso')return true;
  const p=perfilAtual();if(!p)return false;
  return p==='Administrador'||rotasDoPerfil(p).includes(k);
}
function rotaInicial(){return NAV.flatMap(g=>g.i.map(i=>i[0])).find(podeRota)||'sem_acesso'}
function meuColaborador(){const u=meuUsuario();return u&&u.colaborador||''}
function soMinhasOS(rows){
  if(perfilAtual()!=='Técnico')return rows;
  const c=meuColaborador();return c?rows.filter(o=>o.tecnico===c):[];
}

R.sem_acesso=v=>{
  document.getElementById('ttl').textContent='Sem acesso';
  document.getElementById('sub').textContent='';
  v.innerHTML='<div class="card" style="max-width:480px;margin:30px auto"><div class="cbody"><div class="empty">'+
    'Seu usuário ainda não tem um perfil de acesso ativo. Peça ao administrador para liberar em Sistema → Acessos.</div></div></div>';
};

function faixaPerfil(){
  let f=document.getElementById('faixa');
  const simulando=MODE!=='supabase'&&VER_COMO&&VER_COMO.perfil&&VER_COMO.perfil!=='Administrador';
  if(!simulando){if(f)f.remove();}
  else{
    if(!f){f=document.createElement('div');f.id='faixa';document.body.appendChild(f)}
    const c=VER_COMO.colaborador?byId('colaboradores',VER_COMO.colaborador):null;
    f.innerHTML=ic('eye',15)+'<span>Vendo como <b>'+esc(VER_COMO.perfil)+'</b>'+(c?' · '+esc(c.nome):'')+'</span><button class="btn sec sm" id="fxV">Sair do teste</button>';
    document.getElementById('fxV').onclick=()=>verComo(null);
  }
  if(MODE==='supabase'&&SB_USER){
    const p=perfilAtual();
    document.getElementById('stat').textContent=[ORG_NOME,SB_USER.email,p].filter(Boolean).join(' · ')+' · sair';
  }
}
function verComo(v){
  VER_COMO=v;try{v?sessionStorage.setItem('ao-ver-como',JSON.stringify(v)):sessionStorage.removeItem('ao-ver-como')}catch(e){}
  route=rotaInicial();render();window.scrollTo(0,0);
}

R.acessos=v=>{
  const us=S.usuarios.slice().sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||'')));
  const nomesRota=p=>{const rs=rotasDoPerfil(p);return PERFIS[p].g==='*'?'Todas as telas':rs.map(k=>(NAV.flatMap(g=>g.i).find(i=>i[0]===k)||[,k])[1]).join(', ')};
  v.innerHTML='<div class="toolbar"><button class="btn" id="nv">+ Novo acesso</button></div>'+
    '<div class="card"><div class="chead"><h2>Usuários</h2></div><div class="cbody" id="lst"></div></div>'+
    '<div class="card"><div class="chead"><h2>Perfis</h2></div><div class="cbody">'+
    tbl([{l:'Perfil',f:r=>'<span class="bg '+PERFIS[r.id].cor+'">'+esc(r.id)+'</span>'},{l:'O que acessa',s:1,f:r=>esc(PERFIS[r.id].d)},
      {l:'Telas',f:r=>'<small>'+esc(nomesRota(r.id))+'</small>'},{l:'Usuários',n:1,f:r=>us.filter(u=>u.perfil===r.id&&ativo(u)).length}],
      NOMES_PERFIS.map(p=>({id:p})))+'</div></div>'+
    (MODE==='supabase'?
      '<div class="note">Cada pessoa entra com o próprio e-mail e senha. Antes de cadastrar o acesso aqui, crie o usuário no painel do Supabase (Authentication → Users → Add user). Ao salvar, o e-mail é ligado a '+esc(ORG_NOME||'esta empresa')+'.</div>':
      '<div class="card"><div class="chead"><h2>Testar um perfil</h2></div><div class="cbody">'+
        '<div class="note" style="margin:0 0 10px">Nesta versão não há login, então quem abre o sistema é administrador. Quando o sistema estiver no Supabase, cada pessoa entra com o próprio e-mail e vê só o que o perfil dela permite. Use o teste abaixo para conferir o que cada perfil enxerga.</div>'+
        '<div class="frow">'+field({k:'vp',l:'Perfil',t:'select',opts:NOMES_PERFIS.filter(p=>p!=='Administrador'),req:1},'Comercial')+
        field({k:'vc',l:'Técnico (para o perfil Técnico)',t:'ref',col:'colaboradores',filtro:ehTecnico},'')+'</div>'+
        '<button class="btn sec" id="vcB">'+ic('eye',15)+' Ver o sistema como este perfil</button></div></div>');
  document.getElementById('nv').onclick=()=>editarAcesso(null);
  const el=document.getElementById('lst');
  el.innerHTML=tbl([{l:'Nome',s:1,f:r=>esc(r.nome||'')},{l:'E-mail',f:r=>esc(r.email||'')},
    {l:'Perfil',f:r=>PERFIS[r.perfil]?'<span class="bg '+PERFIS[r.perfil].cor+'">'+esc(r.perfil)+'</span>':'—'},
    {l:'Pessoa',f:r=>r.colaborador?esc(nm('colaboradores',r.colaborador)):'—'},
    {l:'Status',f:r=>'<span class="bg '+(ativo(r)?'g-green':'g-gray')+'">'+(ativo(r)?'Ativo':'Inativo')+'</span>'}],
    us,{acts:1,empty:'Nenhum acesso cadastrado ainda.'+(MODE==='supabase'?' Você entra como administrador por ter criado a empresa.':'')});
  el.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>editarAcesso(b.dataset.ed));
  const vb=document.getElementById('vcB');
  if(vb)vb.onclick=()=>{
    const p=document.getElementById('f_vp').value,c=document.getElementById('f_vc').value;
    if(p==='Técnico'&&!c){toast('Escolha qual técnico, para ver as OS dele.');return}
    verComo({perfil:p,colaborador:p==='Técnico'?c:''});
  };
};

function editarAcesso(id){
  const rec=id?byId('usuarios',id):{perfil:'Comercial',status:'Ativo'};
  const souEu=MODE==='supabase'&&SB_USER&&id&&normEmail(rec.email)===normEmail(SB_USER.email);
  const F=[{k:'colaborador',l:'Pessoa (Cadastros → Pessoas)',t:'ref',col:'colaboradores',full:1,filtro:c=>ativo(c),rotulo:c=>c.nome+(c.tipo?' · '+c.tipo:'')},
    {k:'nome',l:'Nome',req:1},{k:'email',l:'E-mail de login',req:1},
    {k:'perfil',l:'Perfil',t:'select',opts:NOMES_PERFIS,req:1},
    {k:'status',l:'Status',t:'select',opts:['Ativo','Inativo'],req:1}];
  openM(id?'Editar acesso':'Novo acesso',formHtml(F,rec)+
    '<div class="note" id="acD">'+esc((PERFIS[rec.perfil]||{}).d||'')+'</div>'+
    '<div class="note">Escolha a pessoa para puxar nome e e-mail do cadastro. No perfil Técnico, a pessoa precisa estar cadastrada como Técnico: é por ela que o sistema mostra só as OS dele.</div>'+
    (id&&!souEu?'<div style="margin-top:6px"><button class="btn dgr sm" id="mDel">Excluir acesso</button></div>':''),'Salvar',async d=>{
    d.email=normEmail(d.email);
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)){toast('E-mail inválido.');return}
    if(S.usuarios.some(u=>u.id!==id&&normEmail(u.email)===d.email)){toast('Já existe um acesso com esse e-mail.');return}
    const pes=d.colaborador?byId('colaboradores',d.colaborador):null;
    if(d.perfil==='Técnico'&&!pes){toast('No perfil Técnico, escolha a pessoa: é por ela que o sistema mostra só as OS dele.');return}
    if(d.perfil==='Técnico'&&!ehTecnico(pes)){toast(pes.nome+' não está cadastrado(a) como Técnico em Pessoas.');return}
    if(d.colaborador&&S.usuarios.some(u=>u.id!==id&&u.colaborador===d.colaborador)){toast(pes.nome+' já tem um acesso cadastrado.');return}
    const virouEu=MODE==='supabase'&&SB_USER&&d.email===normEmail(SB_USER.email);
    if((souEu||virouEu)&&(d.perfil!=='Administrador'||d.status!=='Ativo')){toast('Você não pode tirar o seu próprio acesso de administrador.');return}
    if(MODE==='supabase'){
      const m=document.getElementById('mSave');if(m)m.disabled=true;
      const r=d.status==='Ativo'
        ?await SB.rpc('adicionar_membro',{p_org:ORG,p_email:d.email,p_papel:d.perfil==='Administrador'?'admin':'membro'})
        :await SB.rpc('remover_membro',{p_org:ORG,p_email:d.email});
      if(m)m.disabled=false;
      if(r.error){toast(r.error.message);return}
    }
    put('usuarios',Object.assign({},id?rec:{},d));
    if(pes&&!pes.email){pes.email=d.email;put('colaboradores',pes)}   // completa o e-mail no cadastro da pessoa
    toast('Acesso salvo');closeM();render();
  });
  const sel=document.getElementById('f_perfil'),dsc=document.getElementById('acD');
  if(sel)sel.onchange=()=>{dsc.textContent=(PERFIS[sel.value]||{}).d||''};
  const ps=document.getElementById('f_colaborador');
  if(ps)ps.onchange=()=>{
    const c=byId('colaboradores',ps.value);if(!c)return;
    document.getElementById('f_nome').value=c.nome||'';
    if(c.email)document.getElementById('f_email').value=c.email;
    if(!id&&ehTecnico(c)&&sel){sel.value='Técnico';sel.onchange()}
  };
  const b=document.getElementById('mDel');
  if(b)b.onclick=async()=>{
    if(!await ask('Excluir o acesso de '+(rec.nome||rec.email)+'? A pessoa deixa de entrar no sistema.','Excluir'))return;
    if(MODE==='supabase'){const r=await SB.rpc('remover_membro',{p_org:ORG,p_email:rec.email});if(r.error){toast(r.error.message);return}}
    del('usuarios',id);toast('Acesso excluído');closeM();render();
  };
}
if(MODE!=='supabase')render();
