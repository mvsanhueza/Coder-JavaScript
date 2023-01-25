// --------- ELEMENTOS HTML


const inputAncho = document.getElementById('ancho');
const inputAlto = document.getElementById('alto');
const chart = document.getElementById('chart');
const tableCargas = document.getElementById('tableCargas');
const addCarga = document.getElementById('btn_addCarga');
const tableBarras = document.getElementById('tableBarras');


// ----- CLASES
//clase de una barra (diametro en mm):
class barra {
  constructor(n, y, Diametro) {
    this.n = n;
    this.y = y;
    this.Diametro = Diametro;
    this.Area = n * Math.PI * Math.pow(Diametro / 20.0, 2);
  }
}

//clase de puntos de cargas externas:
class carga {
  constructor(P, M) {
    this.P = P;
    this.M = M;
  }
}


//---------- FUNCIONES
//Linspace para generar array de datos
function linspace(start, end, n) {
  const array = [];
  let step = (end - start) / (n - 1);
  for (let i = 0; i < n; i++) {
    array.push(i * step + start);
  }

  return array;
}
//Funcion para generar curva de interacción:
function genCurvaInteraccion() {
  
  let ancho = parseInt(inputAncho.value);
  let alto = parseInt(inputAlto.value);

  let d = alto - 2;

  //Se asume armadura 2 phi 16 superior e inferior con recubrimiento de 2cm para primera entrega:
  // const barra1 = new barra(rec, d, 16);
  // const barra2 = new barra(ancho - rec, d, 16);
  // const barra3 = new barra(rec, rec, 16);
  // const barra4 = new barra(ancho - rec, rec, 16);

  const barras = readSessionStorageJSON('barras');

  //Se definen las deformaciones unitarias con las que se genera la curva de interaccion:
  let eps = [-0.002, 0]; //Def unitarias del acero
  eps = eps.concat(linspace(0.00025, 0.02, 80));
  eps.push(0.02);

  const epc = [];
  //Propiedades Acero:
  let fy = 4200; //En kgf/cm2
  let Es = 2.1e6; //En kgf/cm2

  //Se define el tipo de hormigon (para entrega 1 se asume G25 (f'c = 25MPa))
  let fcp = 250; //En kgf/cm2
  let beta1 = Math.max(0.65, fcp / 10.0 > 28 ? 0.085 - (0.05 * (fcp / 10.0 - 28) / 7) : 0.85);

  //Se agrega compresion pura:
  let As = 0;
  barras.forEach(b => As += b.Area);

  let M = [];
  let P = [];
  const phis = [];

  let PMax = 0;
  let inter = true;


  //Se itera generando la curva de interaccion
  for (let i = 0; i < eps.length; i++) {

    let es = eps[i];
    let phi = es <= 0.002 ? 0.65 : Math.min(0.9, 0.65 + (0.9 - 0.65) / 0.003 * (es - 0.002));
    phis.push(phi);
    if (i === 0) {
      //Compresion pura:
      M.push(0);
      PMax = -(0.85 * fcp * (ancho * alto - As) + As * fy) * 0.8;
      P.push(PMax);
      continue;
    }
    else if (i === eps.length - 1) {
      //Traccion pura
      let Fs = 0;
      let Ms = 0;
      for (let k = 0; k < barras.length; k++) {
        let b = barras[k];
        let fs = b.Area * fy;
        Fs += fs;
        Ms += fs * (b.y - alto / 2);
      }

      M.push(Ms);
      P.push(Fs);

      continue;
    }

    let ec = -0.003;
    let c = -d * ec / (-ec + es);
    let a = beta1 * c;

    let C = -0.85 * fcp * a * ancho;
    //Fuerza de las barras:
    let Fs = 0;
    let Ms = 0;

    for (let k = 0; k < barras.length; k++) {
      let b = barras[k];
      let esi = b.y * (-ec + es) / d + ec;
      let fs = (Math.abs(Es * esi) <= fy ? Es * esi : Math.sign(esi) * fy) * b.Area;
      Fs += fs;
      Ms += fs * (b.y - alto / 2.0);
    }

    let Pi = (Fs + C);
    let Mi = (Ms - C * (alto / 2 - a / 2));

    if (Pi > PMax && P[i - 1] < PMax) {
      //Se interpola para que termine en recta la curva de interaccion:
      Mi = (PMax - P[i - 1]) / (Pi - P[i - 1]) * (Mi - M[i - 1]) + M[i - 1];
      Pi = PMax;
      inter = false;
    }

    P.push(Math.max(Pi, PMax));
    M.push(Mi);

  }

  //Se invierte la carga axial a compresion positiva y se amplifican por phi:
  P = P.map((p, k) => p * -phis[k] / 1000); //tonf
  M = M.map((m, k) => m * -phis[k] / 100 / 1000); //tonf-m

  //Se agregan los mismos puntos al revez y M invertido por simetria de seccion:
  const PRev = [...P];
  const MRev = M.map(x => x * -1);

  PRev.reverse();
  MRev.reverse();

  P = P.concat(PRev);
  M = M.concat(MRev);

  const curva = [P, M];
  saveSessionStorageJSON('curva', curva);
  plotCurva();  
}
function isMayor10(dimension) {
  if (dimension <= 10) {
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'La dimensión debe ser superior a 10 cm',
    })
    return false;
  }

  return true;
}
function readSessionStorageJSON(name) {
  return JSON.parse(sessionStorage.getItem(name));
}
function saveSessionStorageJSON(name, object) {
  sessionStorage.setItem(name, JSON.stringify(object));
}
function plotCargasTable(cargas) {

  let childs = tableCargas.childElementCount;
  let childsRemove = [];
  for(let i = 1; i < childs; i++){
    let child = tableCargas.children[i];
    childsRemove.push(child);
  }

  for (const child of childsRemove) {
    tableCargas.removeChild(child);
  }

  for (const carga of cargas) {
    tableCargas.innerHTML +=
      `<tr>
    <td>
    <input class="inputCargas" type="text" value=${carga.P} onkeyup="cargaChanged(this)">
    </td>
    <td>
    <input class="inputCargas" type="text" value=${carga.M} onkeyup="cargaChanged(this)">
    </td>
    <td>
    <button type="button" class="btn_removeCarga" onclick="cargaRemove(this)">
      <i class="bi bi-dash-circle-fill removeCarga"></i>
    </button>    
    </td>
    </tr>`;
  }
}
function plotBarrasTable(barras){
  let childs = tableBarras.childElementCount;
  let childsRemove = [];
  for(let i = 1; i < childs; i++){
    let child = tableBarras.children[i];
    childsRemove.push(child);
  }

  for (const child of childsRemove) {
    tableBarras.removeChild(child);
  }

  for (const barra of barras) {
    const tr = document.createElement('tr');
    const tdCant = document.createElement('td');

    //Se genera el select de la primera cantidad de barras:
    const selectCant = createSelect();

    //Se agregan las opciones de cantidad
    agregarCantidades(selectCant,barra.n);

    tdCant.appendChild(selectCant);
    tr.appendChild(tdCant);

    //Se generan los diametros:
    const tdDiam = document.createElement('td');
    const selectDiam = createSelect();
    //se agregan las opciones de diametros:
    agregarDiametros(selectDiam,barra.Diametro);

    tdDiam.appendChild(selectDiam);
    tr.appendChild(tdDiam);

    const tdLocation = document.createElement('td');
    tdLocation.innerHTML = `<input class="inputCargas" type ="number" value=${barra.y} onkeypress="onlyNumberInt(event)" onblur="locationChanged(this)">`    

    tr.appendChild(tdLocation);
    tableBarras.appendChild(tr);
  }
}

function createSelect(){
  const select = document.createElement('select');
  select.className = "form-select form-select-sm";
  select.ariaLabel = ".form-select-sm example";
  return select;
}

function agregarCantidades(selector, cantidad){
  //Se genera una lista de 2 a 5 barras:
  const cantidades = [2,3,4,5];
  for (const cant of cantidades) {
    const opt = document.createElement('option');
    opt.value = cant;
    opt.text = cant;
    if(cant == cantidad)
    {
      opt.selected = true;
    }
    selector.appendChild(opt);
  }
}

function agregarDiametros(selector, diametro){
  const diametros = [12, 16, 18, 22, 25, 28, 32];
  for (const diam of diametros) {
    const opt = document.createElement('option');
    opt.value = diam;
    opt.text = diam;
    if(diam == diametro)
    {
      opt.selected = true;
    }
    selector.appendChild(opt);
  }
}

function locationChanged(input){
  //Se compara con el alto del elemento
  const d = parseInt(input.value);
  const alto = parseInt(inputAlto.value);

  if(d<alto && d > 0){
    input.classList.remove("error");
    return;
  }

  //En caso contrario se abre el sweep:
  input.classList.add("error")
  
  input.focus();
}

//Solo numeros enteros
function onlyNumberInt(evt) {
  let theEvent = evt;

  let key;

  //Caso que se pegue el dato
  if (theEvent.type === 'paste') {
    key = Event.clipboardData.getData('text/plain');
  }
  else {
    key = theEvent.keyCode || theEvent.which;
    key = String.fromCharCode(key);
  }

  let regex = /[0-9]|\./;
  if (!regex.test(key)) {
    theEvent.returnValue = false;
    if (theEvent.preventDefault) theEvent.preventDefault();
  }
}
//Solo numeros, positivos negativos puntos etc
function cargaChanged(input) {
  var regex = /^[+-]?\d*\.?\d{0,9}$/;
  let value = input.value;
  if (!regex.test(input.value)) {
    input.value = input.value.substring(0, input.value.length - 1);
    return;
  }

  actualizarCargas();
  plotCurva();
}

function cargaAdd(){
//Se agrega una carga a la lista de cargas:
let cargas = readSessionStorageJSON('cargas');
cargas.push(new carga(0,0));
plotCargasTable(cargas);
saveSessionStorageJSON('cargas',cargas);
plotCurva();
}

function cargaRemove(carga){
  //Se busca el parent para identificar el row correspondiente:
  const parent = carga.parentElement;
  const parentParent = parent.parentElement;

  let rowIndex = parentParent.rowIndex;

  //Se elimina la carga correspondiente:
  let cargas = readSessionStorageJSON('cargas');

  //No se elimina cuando queda un elemento (siempre debe haber alguna carga)
  if(cargas.length > 1){
    let removed = cargas.splice(rowIndex - 1, 1);
    saveSessionStorageJSON('cargas',cargas);
    plotCargasTable(cargas);
    plotCurva();
  } 
}

function actualizarCargas() {
  let cargas = [];
  //De la tabla se buscan todas las filas de cargas creadas:
  let filas = tableCargas.getElementsByTagName("tr");
  for (const fila of filas) {
    const tds = fila.getElementsByTagName('td');
    if (tds.length === 0) {
      continue;
    }

    const inputP = tds[0].getElementsByTagName('input')[0];
    const inputM = tds[1].getElementsByTagName('input')[0];

    //Valor de P y M
    let P = parseFloat(inputP.value);
    let M = parseFloat(inputM.value);

    const c = new carga(P, M);
    cargas.push(c);
  }

  saveSessionStorageJSON('cargas', cargas);
}

function plotCurva() {
  //Busca la curva
  const curva = readSessionStorageJSON('curva');
  const cargas = readSessionStorageJSON('cargas');
  
  //Si no existen cargas ni curva se borra
  if (curva == null || cargas == null) {
    return;
  }

  //Dato de curva:
  const [P, M] = [curva[0], curva[1]];
  let dataEjeFuerte = {
    x: M,
    y: P,
    mode: "lines",
    name: "Curva",
  };

  const Pc = cargas.map(c=>c.P);
  const Mc = cargas.map(c=>c.M);

  //Datos de las cargas:
  let dataCargas = {
    x: Mc,
    y: Pc,
    mode: "markers",
    type: "scatter",
    marker: {size: 12},
    name: "Cargas",
  }

  let layout = {
    title: "Curva de interacción eje fuerte",
    xaxis: {
      title: "Momento [tonf-m]"    
    },
    yaxis: {
      title: "Carga axial [tonf]"
    },
  }

  Plotly.newPlot(chart, [dataEjeFuerte, dataCargas], layout);
}

function verifyAnchoAlto() {
  //Primero verifica que el ancho y alto sean mayor a 10 cm:
  let ancho = parseInt(inputAncho.value);
  let alto = parseInt(inputAlto.value);

  //se verifica que el ancho sea mayor a 10:
  let verifyAncho = isMayor10(ancho);
  let verifyAlto = isMayor10(alto);
  if (!verifyAncho || !verifyAlto) {
    return false;
  }
  else
    return true;
}

alto.addEventListener('blur', ()=>{
  //Se analiza si alto y ancho tiene valores correctos:
  let alto = parseInt(inputAlto.value);

  if(!isMayor10(alto)){
    inputAlto.value = "";
    return;
  }

  let ancho = inputAncho.value;

  if(ancho == ""){
    return;
  }

  let rec = 2;
  
  let d = alto - rec
  const barras = readSessionStorageJSON('barras') ?? [new barra(2,d,16), new barra(2,rec,16)];

  //Se actualiza el grafico de barras:
  plotBarrasTable(barras);
  saveSessionStorageJSON('barras',barras);
  
  genCurvaInteraccion();
})

ancho.addEventListener('blur',()=>{
  //Se analiza si alto y ancho tiene valores correctos:
 let ancho = parseInt(inputAncho.value);

 if(!isMayor10(ancho)){
    inputAncho.value = "";
    return;
 }

 let alto = inputAlto.value;

 if(alto == "" ){
  return;
 }

  let rec = 2;
  let altoInt = parseInt(alto);
  let d = altoInt - rec
  const barras = readSessionStorageJSON('barras') ?? [new barra(2,d,16), new barra(2,rec,16)];
  plotBarrasTable(barras);
  saveSessionStorageJSON('barras',barras);  

  genCurvaInteraccion();
})

//Se crea la lista de las cargas en caso que no exista:
const cargas = readSessionStorageJSON('cargas') ?? [new carga(0, 0)];


saveSessionStorageJSON('cargas', cargas);
//Se plotean las cargas 
plotCargasTable(cargas);

const barras = readSessionStorageJSON('barras');
if(barras != null){
  //Analiza que ancho y alto tengan respuesta:
  let ancho = inputAncho.value;
  let alto = inputAlto.value;

  if(ancho == "" || alto == ""){
    //Se borran las barras existentes:
    const barrasNew = [];
    sessionStorage.removeItem('barras');
    plotBarrasTable([]);
  }else{
    plotBarrasTable(barras);
    genCurvaInteraccion();
  }  
}




