/* ---------- modo Supabase: login, dados por organização, tempo real e arquivos ----------
   Liga sozinho quando config.js define window.AO_CONFIG com supabaseUrl e supabaseAnonKey.
   Estrutura do banco: supabase/schema.sql. Passo a passo: SUPABASE.md. */
let SB=null,ORG=null,ORG_NOME='',ORG_PAPEL='',SB_USER=null,sbCanal=null,sbRenderT=null,sbIniciando=false,sbAssinaT=null;
const SB_URLS={};
const SB_BUCKET='anexos';
const sbCfg=()=>window.AO_CONFIG||{};
const temSupabase=()=>!!(sbCfg().supabaseUrl&&sbCfg().supabaseAnonKey);

async function bootSupabase(){
  const st=document.getElementById('stat');st.textContent='conectando…';
  try{if(!window.supabase)await carregarScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')}
  catch(e){document.getElementById('view').innerHTML='<div class="empty">Não foi possível carregar o Supabase. Verifique a conexão com a internet.</div>';return}
  SB=window.supabase.createClient(sbCfg().supabaseUrl,sbCfg().supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
  MODE='supabase';
  st.style.cursor='pointer';
  st.onclick=async()=>{if(SB_USER&&await ask('Sair do Ative One?','Sair'))await SB.auth.signOut()};
  SB.auth.onAuthStateChange((ev,sess)=>{
    if(ev==='SIGNED_OUT')sbTelaLogin();
    else if(sess&&sess.user&&(!SB_USER||SB_USER.id!==sess.user.id))sbIniciar(sess.user);
  });
  const r=await SB.auth.getSession();
  const sess=r&&r.data&&r.data.session;
  if(sess)sbIniciar(sess.user);else sbTelaLogin();
}

function sbLimpar(){
  if(sbCanal){try{SB.removeChannel(sbCanal)}catch(e){}sbCanal=null}
  clearInterval(sbAssinaT);SB_USER=null;ORG=null;ORG_NOME='';
  COLS.forEach(c=>S[c]=[]);
}
function sbTela(titulo,sub,html){
  document.body.classList.add('login');
  document.getElementById('side').style.display='none';
  document.getElementById('burger').style.display='none';
  document.getElementById('ttl').textContent=titulo;
  document.getElementById('sub').textContent=sub;
  document.getElementById('view').innerHTML='<div class="card" style="max-width:400px;margin:40px auto"><div class="cbody">'+
    '<div style="text-align:center;margin:4px 0 16px"><img src="assets/simbolo-app.png" alt="" style="height:46px;background:#0a0d14;padding:8px 12px;border-radius:12px"></div>'+html+'</div></div>';
}
function sbTelaLogin(msg){
  sbLimpar();
  document.getElementById('stat').textContent='Ative One';
  sbTela('Entrar','Acesso restrito à equipe',
    '<label class="f"><span>E-mail</span><input type="text" id="lgE" autocomplete="username" inputmode="email"></label>'+
    '<label class="f"><span>Senha</span><input type="password" id="lgS" autocomplete="current-password" style="width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:7px;background:var(--panel-2)"></label>'+
    '<button class="btn" id="lgB" style="width:100%;justify-content:center">Entrar</button>'+
    '<div style="text-align:center;margin-top:10px"><button class="btn sec sm" id="lgR">Esqueci a senha</button></div><div class="note" id="lgM">'+esc(msg||'')+'</div>');
  const m=document.getElementById('lgM');
  const entrar=async()=>{
    const email=document.getElementById('lgE').value.trim(),senha=document.getElementById('lgS').value;
    if(!email||!senha){m.textContent='Informe e-mail e senha.';return}
    m.textContent='Entrando…';
    const {data,error}=await SB.auth.signInWithPassword({email:email,password:senha});
    if(error){m.textContent=/invalid|credential/i.test(error.message||'')?'E-mail ou senha incorretos.':/confirm/i.test(error.message||'')?'Confirme o e-mail antes de entrar (veja sua caixa de entrada).':'Não foi possível entrar: '+error.message;return}
    if(data&&data.user)sbIniciar(data.user);
  };
  document.getElementById('lgB').onclick=entrar;
  document.getElementById('lgS').onkeydown=e=>{if(e.key==='Enter')entrar()};
  document.getElementById('lgR').onclick=async()=>{
    const email=document.getElementById('lgE').value.trim();
    if(!email){m.textContent='Digite seu e-mail acima e clique de novo em "Esqueci a senha".';return}
    const {error}=await SB.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
    m.textContent=error?'Não foi possível enviar: '+error.message:'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.';
  };
}
function sbTelaCriarOrg(){
  sbTela('Primeiro acesso','Cadastre a empresa que vai usar o sistema',
    '<p class="note" style="margin:0 0 12px">Seu usuário ainda não pertence a nenhuma empresa. Se você é o primeiro a entrar, cadastre a empresa agora e você será o administrador. Se foi convidado, peça ao administrador para liberar seu acesso.</p>'+
    '<label class="f"><span>Nome da empresa</span><input type="text" id="orgN" placeholder="Ex.: Ative One"></label>'+
    '<button class="btn" id="orgB" style="width:100%;justify-content:center">Criar empresa</button>'+
    '<div style="text-align:center;margin-top:10px"><button class="btn sec sm" id="orgS">Sair</button></div><div class="note" id="orgM"></div>');
  document.getElementById('orgS').onclick=()=>SB.auth.signOut();
  document.getElementById('orgB').onclick=async()=>{
    const nome=document.getElementById('orgN').value.trim(),m=document.getElementById('orgM');
    if(!nome){m.textContent='Informe o nome da empresa.';return}
    m.textContent='Criando…';
    const {error}=await SB.rpc('criar_organizacao',{p_nome:nome});
    if(error){m.textContent='Não foi possível criar: '+error.message;return}
    const u=SB_USER;SB_USER=null;sbIniciar(u);
  };
}

async function sbIniciar(user){
  if(sbIniciando)return;sbIniciando=true;
  try{
    SB_USER=user;
    document.getElementById('view').innerHTML='<div class="empty">Carregando dados…</div>';
    const {data:ms,error}=await SB.from('membros').select('org_id,papel,organizacoes(nome)').eq('user_id',user.id);
    if(error){sbTela('Erro','Não foi possível ler seu acesso','<p class="note">'+esc(error.message)+'</p><button class="btn sec" id="sx">Sair</button>');document.getElementById('sx').onclick=()=>SB.auth.signOut();return}
    if(!ms||!ms.length){sbTelaCriarOrg();return}
    let pref='';try{pref=localStorage.getItem('ao-org')||''}catch(e){}
    const m=ms.find(x=>x.org_id===pref)||ms[0];
    ORG=m.org_id;ORG_PAPEL=m.papel;ORG_NOME=(m.organizacoes&&m.organizacoes.nome)||'';
    try{localStorage.setItem('ao-org',ORG)}catch(e){}
    await sbCarregar();
    sbOuvir();
    await sbAssinarUrls();
    clearInterval(sbAssinaT);sbAssinaT=setInterval(sbAssinarUrls,5*3600*1000);
    document.body.classList.remove('login');
    document.getElementById('side').style.display='';
    document.getElementById('burger').style.display='';
    document.getElementById('stat').textContent=(ORG_NOME?ORG_NOME+' · ':'')+user.email+' · sair';
    render();
  }finally{sbIniciando=false}
}

async function sbCarregar(){
  COLS.forEach(c=>S[c]=[]);
  const lote=1000;
  for(let de=0;;de+=lote){
    const {data,error}=await SB.from('registros').select('colecao,id,dados').eq('org_id',ORG).range(de,de+lote-1);
    if(error){toast('Erro ao carregar dados: '+error.message);break}
    (data||[]).forEach(r=>{if(S[r.colecao])S[r.colecao].push(Object.assign({},r.dados,{id:r.id}))});
    if(!data||data.length<lote)break;
  }
}

function sbOuvir(){
  if(sbCanal){try{SB.removeChannel(sbCanal)}catch(e){}}
  const aplicar=(tipo,row)=>{
    if(!row||!S[row.colecao]||row.org_id!==ORG)return;
    const c=row.colecao;
    if(tipo==='DELETE'){const n=S[c].length;S[c]=S[c].filter(x=>x.id!==row.id);if(S[c].length===n)return}
    else{
      const rec=Object.assign({},row.dados,{id:row.id}),i=S[c].findIndex(x=>x.id===rec.id);
      if(i>=0){if(JSON.stringify(S[c][i])===JSON.stringify(rec))return;S[c][i]=rec}else S[c].push(rec);
    }
    clearTimeout(sbRenderT);sbRenderT=setTimeout(()=>{if(!ovl.classList.contains('on'))render()},200);
  };
  sbCanal=SB.channel('registros-'+ORG)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'registros',filter:'org_id=eq.'+ORG},p=>aplicar('INSERT',p.new))
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'registros',filter:'org_id=eq.'+ORG},p=>aplicar('UPDATE',p.new))
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'registros'},p=>aplicar('DELETE',p.old))
    .subscribe();
}

const sbErro=e=>erroSalvar({message:(e&&e.message)||'erro'});
function sbSalvar(c,op){
  if(!SB||!ORG)return Promise.resolve();
  const T=()=>SB.from('registros');
  if(op.type==='upsert')return T().upsert({org_id:ORG,colecao:c,id:op.rec.id,dados:limpo(op.rec)}).then(r=>{if(r.error)sbErro(r.error)});
  if(op.type==='remove')return T().delete().eq('org_id',ORG).eq('colecao',c).eq('id',op.id).then(r=>{if(r.error)sbErro(r.error)});
  return sbSubstituir(c).catch(sbErro);
}
// grava a coleção inteira (importação de backup, ações em lote)
async function sbSubstituir(c){
  const T=()=>SB.from('registros'),ids=new Set(S[c].map(r=>r.id)),exist=[];
  for(let de=0;;de+=1000){
    const {data,error}=await T().select('id').eq('org_id',ORG).eq('colecao',c).range(de,de+999);
    if(error)throw error;(data||[]).forEach(r=>exist.push(r.id));if(!data||data.length<1000)break;
  }
  const sobra=exist.filter(id=>!ids.has(id));
  for(let i=0;i<sobra.length;i+=200){const {error}=await T().delete().eq('org_id',ORG).eq('colecao',c).in('id',sobra.slice(i,i+200));if(error)throw error}
  const linhas=S[c].map(r=>({org_id:ORG,colecao:c,id:r.id,dados:limpo(r)}));
  for(let i=0;i<linhas.length;i+=500){const {error}=await T().upsert(linhas.slice(i,i+500));if(error)throw error}
}

/* arquivos no Storage (bucket privado; os links são assinados e renovados) */
async function sbSubirArquivo(file,pasta,type){
  const path=ORG+'/'+pasta+'/'+uid()+'-'+String(file.name).replace(/[^\w.\-]/g,'_');
  const st=SB.storage.from(SB_BUCKET);
  const {error}=await st.upload(path,file,{contentType:type,upsert:false});
  if(error)throw{code:/quota|size|exceed/i.test(error.message||'')?'quota_or_state':'sb_upload',message:error.message};
  const s=await st.createSignedUrl(path,21600);
  if(s&&s.data)SB_URLS[path]=s.data.signedUrl;
  return{sbpath:path,tamanho:file.size,contentType:type};
}
async function sbRemoverArquivo(d){if(d&&d.sbpath)await SB.storage.from(SB_BUCKET).remove([d.sbpath])}
function sbCaminhos(){
  const out=new Set();
  const varrer=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(varrer);return}
    if(typeof v.sbpath==='string')out.add(v.sbpath);Object.keys(v).forEach(k=>{if(v[k]&&typeof v[k]==='object')varrer(v[k])})};
  COLS.forEach(c=>varrer(S[c]));
  return [...out];
}
async function sbAssinarUrls(){
  if(!SB||!ORG)return;
  const ps=sbCaminhos();
  for(let i=0;i<ps.length;i+=100){
    try{const {data}=await SB.storage.from(SB_BUCKET).createSignedUrls(ps.slice(i,i+100),21600);
      (data||[]).forEach(x=>{if(x&&x.signedUrl)SB_URLS[x.path]=x.signedUrl})}catch(e){}
  }
}

/* acesso de outras pessoas: o administrador libera usuários já criados no Supabase */
function sbDarAcesso(){
  if(ORG_PAPEL!=='admin'){toast('Só o administrador da empresa pode liberar acesso.');return}
  openM('Dar acesso ao sistema',
    '<div class="note" style="margin:0 0 10px">Crie o usuário antes no painel do Supabase (Authentication → Users → Add user), com e-mail e senha. Depois informe o e-mail aqui para ligar a pessoa a '+esc(ORG_NOME||'esta empresa')+'.</div>'+
    field({k:'email',l:'E-mail do usuário',req:1},'')+field({k:'papel',l:'Papel',t:'select',opts:[{v:'membro',l:'Membro (usa o sistema)'},{v:'admin',l:'Administrador (também libera acessos)'}],req:1},'membro'),
    'Dar acesso',async d=>{
      const {error}=await SB.rpc('adicionar_membro',{p_org:ORG,p_email:d.email,p_papel:d.papel});
      if(error){toast(error.message);return}
      closeM();toast('Acesso liberado para '+d.email);
    });
}
