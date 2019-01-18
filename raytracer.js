"use strict";
//prova

var test = 0;
var objpointer = null;

//ALIAS UTILI
var Vector3 = glMatrix.vec3;
var Matrix4 = glMatrix.mat4;
var Matrix3 = glMatrix.mat3;

//CORE VARIABLES
var canvas;
var context;
var imageBuffer;
var aspect;
var heigth;
var width;

var DEBUG = false; //whether to show debug messages
var EPSILON = 0.00001; //error margins

//scene to render
var scene;
var camera;
var surfaces = [];
var lights = [];
// var materials = [];

//etc...

//CLASSES PROTOTYPES
class Camera {
  constructor(eye,up,at) {
    this.eye = Vector3.fromValues(eye[0],eye[1],eye[2]);   // Posizione della camera  (e)
    this.up = Vector3.fromValues(-up[0],-up[1],-up[2]);     // Inclinazione testa        (t)
    this.at = Vector3.fromValues(at[0],at[1],at[2]);     // Direzione dello sguardo   (g) 

    //Ricavo il camera frame {u,v,w} dai vettori eye,at,up (lezione 8, slide 19)
    // Il camera frame è necessario per usare le formule nel calcolo delle intersezioni
    // this.w = Vector3.normalize([], Vector3.scale([], this.at, -1)); // - normalize(at);
    this.w = Vector3.scale([], Vector3.normalize([], this.at), -1);
    this.u = Vector3.normalize([], Vector3.cross([], this.up, this.w)); //normalize(up * w)
    this.v = Vector3.cross([], this.w, this.u); //w * u;

    // console.log(this.w, this.u, this.v);

    //Calcolo la ViewMatrix
    //this.viewMatrix = makeViewMatrix();
  }

  
  makeViewMatrix() { //calcola la ViewMatrix
    var eyeX = this.eye[0], eyeY = this.eye[1], eyeZ = this.eye[2];
    var centerX = this.at[0], centerY = this.at[1], centerZ = this.at[2];
    var upX = this.up[0], upY = this.up[1], upZ = this.up[2];
    var fx, fy, fz, rlf, sx, sy, sz, rls, ux, uy, uz;
    
    fx = centerX - eyeX;
    fy = centerY - eyeY;
    fz = centerZ - eyeZ;
    
    // Normalize f.
    rlf = 1 / Math.sqrt(fx*fx + fy*fy + fz*fz);
    fx *= rlf;
    fy *= rlf;
    fz *= rlf;
    
    // Calculate cross product of f and up.
    sx = fy * upZ - fz * upY;
    sy = fz * upX - fx * upZ;
    sz = fx * upY - fy * upX;
    
    // Normalize s.
    rls = 1 / Math.sqrt(sx*sx + sy*sy + sz*sz);
    sx *= rls;
    sy *= rls;
    sz *= rls;
    
    // Calculate cross product of s and f.
    ux = sy * fz - sz * fy;
    uy = sz * fx - sx * fz;
    uz = sx * fy - sy * fx;
    
    // Set to this.
    var e = Matrix4.create();
    e[0] = sx;
    e[1] = ux;
    e[2] = -fx;
    e[3] = 0;
    
    e[4] = sy;
    e[5] = uy;
    e[6] = -fy;
    e[7] = 0;
    
    e[8] = sz;
    e[9] = uz;
    e[10] = -fz;
    e[11] = 0;
    
    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;

    return e;
  }


  castRay(x,y) { //calcola il raggio che parte dalla camera e interseca il punto (x,y) nel rettangolo di vista
    //Calcolo la direzione del raggio.
    var dir = Vector3.create();
    var d = 1; //per ipotesi dalle specifiche
    dir[0] = - d * this.w[0] + x * this.u[0] + y * this.v[0];
    dir[1] = - d * this.w[1] + x * this.u[1] + y * this.v[1];
    dir[2] = - d * this.w[2] + x * this.u[2] + y * this.v[2];

    var r = new Ray(this.eye, dir);
    if (DEBUG) console.log("dir:"+dir);
    return r;
    
  }
}

//Surfaces
class Sphere {
  constructor(center, radius, material) {
    this.center = center;
    this.radius = radius;
    this.material = material;
  }

  intersects(ray) {
    
    //Implementa formula sulle slide del prof
    var p = Vector3.subtract([], ray.getOrigin(), this.center); //e - c
    var d = ray.getDirection();
    //console.log("p: "+p+"; d: "+d);
    
    var ddotp = Vector3.dot(d,p);
    if (DEBUG) console.log("d⋅p:"+ddotp);
    var psquare = Vector3.dot(p, p);
    if (DEBUG) console.log("p⋅p: "+psquare);
    var dsquare = Vector3.dot(d, d);
    if (DEBUG) console.log("d⋅d"+dsquare);
    
    var delta = ddotp*ddotp - dsquare*(psquare - this.radius*this.radius);
    if (DEBUG) console.log("delta: "+delta);

    
    if (delta >= 0) {
      var t1 = (-ddotp + Math.sqrt(delta)) / dsquare;
      var t2 = (-ddotp - Math.sqrt(delta)) / dsquare;
      
      //Quale dei due usiamo??
      return t1;
    } 
    else return false;

  }
  
  getNormal(point) { //Calcola le normali come n = (point-center)/radius
    var n = Vector3.create();
    n = Vector3.subtract([], this.center, point);
    n = Vector3.scale([], n, 1/this.radius);
    return n;
  }

  shade(ray, point, normal) {
    var color = Vector3.create();
    // var intensity = 0.001; //attenuazione (atten)

    for (var i = 0; i < scene.lights.length; i++) {

      var light = scene.lights[i];
      
      var ambient = Vector3.create();
      var diffuse = Vector3.create();
      var specular = Vector3.create();

      if (light.source == "Ambient") {
        ambient = Vector3.multiply([], this.material.ka, light.color);
        Vector3.add(color, color, ambient);
      }
      else { //le luci ambientali non influenzano comp. diffusa e speculare (include luci direzionali e puntiformi)

        //Componente Diffusa
        // var l = light.getDirection(point); //l
        var l = Vector3.normalize([], Vector3.subtract([], light.position, point)); // le luci direzionali non hanno posizione

        var nDotL = Vector3.dot(normal, l); //angolo tra normale e raggio di luce!
        nDotL = Math.max(nDotL, 0.0);
        
        diffuse[0] = this.material.kd[0] * light.color[0] * nDotL;
        diffuse[1] = this.material.kd[1] * light.color[1] * nDotL;
        diffuse[2] = this.material.kd[2] * light.color[2] * nDotL;

        Vector3.add(color, color, diffuse);
        
        //Componente Speculare
        // if (nDotL > 0.0) {
          var v = Vector3.normalize([], Vector3.subtract([], camera.eye, point));
          var h = Vector3.normalize([], Vector3.add([], v, l) ); //norm( norm(cameraPos - point) + l )
          var nDoth = Vector3.dot(normal, h);
          nDoth = Math.max(nDoth, 0.0);
          
          //calcola la componente speculare speculat = color*materiale.ks * (hDotN ^ materiale.specular)
          var grey = [0.8, 0.8, 0.8];
          specular[0] = light.color[0] * this.material.ks[0] * Math.pow(nDoth, this.material.shininess);
          specular[1] = light.color[1] * this.material.ks[1] * Math.pow(nDoth, this.material.shininess);
          specular[2] = light.color[2] * this.material.ks[2] * Math.pow(nDoth, this.material.shininess);

          if (test < 1) { console.log(this.material.ks); test++; }
          Vector3.add(color, color, specular);
        
      }
    }
    return color;
  }
  
  
}

class Triangle {
  constructor(p1, p2, p3, material) {
    this.a = p1; // a
    this.b = p2; // b
    this.c = p3; // c
    this.material = material;

    //Normale
    var a_b = Vector3.subtract([], p1,p2);
    var a_c = Vector3.subtract([], p1,p3);
    this.normal = Vector3.cross([], a_b, a_c);
  }

  intersects(ray) {

    var A = Matrix3.fromValues(
      this.a[0]-this.b[0], this.a[0]-this.c[0], ray.dir[0],
      this.a[1]-this.b[1], this.a[1]-this.c[1], ray.dir[1],
      this.a[2]-this.b[2], this.a[2]-this.c[2], ray.dir[2]
    );

    var B = new Float32Array([
      this.a[0]-ray.a[0],
      this.a[1]-ray.a[1],
      this.a[2]-ray.a[2]
    ])
    
    // metodo di cramer come sul libro
    // A
    // a = 0    d = 1    g = 2
    // b = 3    e = 4    h = 5
    // c = 6    f = 7    i = 8

    // B
    // j = 0
    // k = 1
    // l = 2

    var ei_hf = A[4]*A[8] - A[5]*A[7];
    var gf_di = A[2]*A[7] - A[1]*A[8];
    var dh_eg = A[1]*A[5] - A[4]*A[2];

    var ak_jb = A[0]*B[1] - B[0]*A[3];
    var jc_al = B[0]*A[6] - A[0]*B[2];
    var bl_kc = A[3]*B[2] - B[1]*A[6];

    var M = A[0]*( ei_hf ) + A[3]*( gf_di ) + A[6]*( dh_eg ); //
    var beta = ( B[0]*( ei_hf ) + B[1]*( gf_di ) + B[2]*( dh_eg ) )/M; //
    var gamma = ( A[8]*( ak_jb ) + A[5]*( jc_al ) + A[2]*( bl_kc ) )/M; //
    var t = - ( A[7]*( ak_jb ) + A[4]*( jc_al ) + A[1]*( bl_kc ) )/M; //

    // cramer
    if (beta > 0 && gamma > 0 && beta+gamma < 1) { // intersezione
      // console.log("ok");
      return t;
    }
    else return false;
  }

  getNormal(point) {return this.normal;}

  shade(ray, point, normal) {
    
    var color = [0, 0, 0];

    
    



    return color;
  }

}

//Ray-Intersect
class Ray {
  constructor(a,dir) {
    this.a = a; //origine
    this.dir = dir; //direzione
  }
  
  pointAt(t) {
    //return A + t * d
    var tmp = Vector3.create();
    //tmp = Vector3.add([],this.a,Vector3.scale([],this.dir,t)); //non si capisce niente così
    
    tmp[0] = this.a[0] + t * this.dir[0];
    tmp[1] = this.a[1] + t * this.dir[1];
    tmp[2] = this.a[2] + t * this.dir[2];
    
    //if (test < 10) console.log("p(+"+t+"): ["+tmp+"] direzione: "+this.dir);
    return tmp;
  };
  
  getOrigin() {return this.a;}
  getDirection() {return this.dir;}
  
}

// class Intersection{

// }

//Lighting
class Light{
  constructor(color) {
    this.color = color;
  }
}
class AmbientLight extends Light {
  constructor(color) {
    super(color);
  }
}

class PointLight extends Light{
  constructor(color, position) {
    super(color);
    this.position = position;
  }

  getDirection(point) {
    var d = Vector3.subtract([], this.position, point);
    return Vector3.normalize([], d);
  }

  getDistance(point) {
    return Vector3.length(Vector3.subtract([],point, this.position));
  }
}

class DirectionalLight extends Light{
  constructor(color, direction) {
    super(color);
    this.direction = direction;
  }
}


// class Material { //Forse è sufficiente usare i file caricati dal json
//   constructor(ka, kd, ks, shininess) {
//     this.ka = ka;
//     this.kd = kd;
//     this.ks = ks;
//     this.sininess = shininess;
//   }
// }


//initializes the canvas and drawing buffers
function init() {
  canvas = $('#canvas')[0];
  context = canvas.getContext("2d");
  imageBuffer = context.createImageData(canvas.width, canvas.height); //buffer for pixels

  //TEST: Renderizza automaticamente al caricamento
  loadSceneFile('assets/'+$('#scene_file_input').val()+'.json');

  render();
}


//loads and "parses" the scene file at the given path
function loadSceneFile(filepath) {
  scene = Utils.loadJSON(filepath); //load the scene
  heigth = 2*Math.tan(rad(scene.camera.fovy/2.0));
  width = heigth * aspect;
  // console.log(scene.camera); loading is ok

  //set up camera
  aspect = scene.camera.aspect;
  camera = new Camera(scene.camera.eye, scene.camera.up, scene.camera.at);
  // camera.makeViewMatrix(); //a che serve?

  //set up surfaces
  surfaces = [];
  for (var i = 0; i < scene.surfaces.length; i++) {
    //trova il materiale associato alla superficie
    var mat = scene.materials[0];
    for (var j=0; j < scene.materials.length; j++) 
      if (scene.materials[j].name == scene.surfaces[i].name) mat = scene.materials[j];

    //crea oggetto corrispondente
    if (scene.surfaces[i].shape == "Sphere") {
      surfaces.push(new Sphere(scene.surfaces[i].center, scene.surfaces[i].radius, mat));
      // console.log(surfaces[i]);
    }
    if (scene.surfaces[i].shape == "Triangle") {
      surfaces.push(new Triangle(scene.surfaces[i].p1, scene.surfaces[i].p2, scene.surfaces[i].p3, mat));
      // console.log(surfaces[i]);
    }

  }

  //set up lights
  lights = [];
  for (var i = 0; i < scene.lights.length; i++) {
    var light = scene.lights[i];
    if (light.source == "Ambient") {
      lights.push(new AmbientLight(light.color));
      //console.log("type: "+light.source+" color: "+light.color);
    }
    else if (light.source == "Point")  {
      lights.push(new PointLight(light.color, light.position));
      //console.log("type: "+light.source+" color: "+light.color);
    }
    else if (light.source == "Directional") {
      lights.push(new DirectionalLight(light.color, light.direction));
    }
  }

  // materials = [];
  // for (var i = 0; i < scene.materials.length; i++) {
  //   materials.push(new Material(scene.materials[i].ka, scene.materials[i].kd, scene.materials[i].ks, scene.materials[i].shininess));
  // }

}


//renders the scene
function render() {
  var h,w,u,v,s;
  var backgroundcolor = [0,0,0]; //lascia un colore diverso dal nero così si vede se il calcolo della luce sbaglia a calcolare i colori o non funziona proprio
  var start = Date.now(); //for logging
  h = 2*Math.tan(rad(scene.camera.fovy/2.0));
  w = h * aspect;

  var ray, t, color, point, n;
  for (var i = 0; i <= canvas.width;  i++) { //indice bordo sinistro se i=0 (bordo destro se i = nx-1)
    for (var j = 0; j <= canvas.height; j++) {
      u = (w*i/(canvas.width-1)) - w/2.0;
      v = (-h*j/(canvas.height-1)) + h/2.0;

      //fire a ray though each pixel
      var ray = camera.castRay(u, v);
      //if (i < 1 && j< 10) console.log(ray);

      t = false; color = backgroundcolor;
      for (var k = 0; k < surfaces.length; k++) { //for every surface in the scene
        //calculate the intersection of that ray with the scene
        t = surfaces[k].intersects(ray); //TODO: intersects(ray,tmin tmax)
        
        //set the pixel to be the color of that intersection (using setPixel() method)
        if (t == false) setPixel(i, j, backgroundcolor);
        else {
          //Shading computation
          point = ray.pointAt(t);
          n = surfaces[k].getNormal(point);
          
          //compute color influenced by lighting
          color = surfaces[k].shade(ray, point, n);
          
          setPixel(i, j, color);
        }
      }

    }
  }

  //render the pixels that have been set
  context.putImageData(imageBuffer,0,0);

  var end = Date.now(); //for logging
  $('#log').html("rendered in: "+(end-start)+"ms");
  console.log("rendered in: "+(end-start)+"ms");

}

//sets the pixel at the given x,y to the given color
/**
 * Sets the pixel at the given screen coordinates to the given color
 * @param {int} x     The x-coordinate of the pixel
 * @param {int} y     The y-coordinate of the pixel
 * @param {float[3]} color A length-3 array (or a vec3) representing the color. Color values should floating point values between 0 and 1
 */
function setPixel(x, y, color){
  var i = (y*imageBuffer.width + x)*4;
  imageBuffer.data[i] = (color[0]*255) | 0;
  imageBuffer.data[i+1] = (color[1]*255) | 0;
  imageBuffer.data[i+2] = (color[2]*255) | 0;
  imageBuffer.data[i+3] = 255; //(color[3]*255) | 0; //switch to include transparency
}

//converts degrees to radians
function rad(degrees){
  return degrees*Math.PI/180;
}


//on load, run the application
$(document).ready(function(){
  init();
  
  //load and render new scene
  $('#load_scene_button').click(function(){
    var filepath = 'assets/'+$('#scene_file_input').val()+'.json';
    surfaces = [];
    loadSceneFile(filepath);
    render();
  });

  //debugging - cast a ray through the clicked pixel with DEBUG messaging on
  $('#canvas').click(function(e){
    var x = e.pageX - $('#canvas').offset().left;
    var y = e.pageY - $('#canvas').offset().top;
    DEBUG = true;
    var u = (width*x/(canvas.width-1)) - width/2.0;
    var v = (-heigth*y/(canvas.height-1)) + heigth/2.0;
    
    var ray = camera.castRay(u,v); //cast a ray through the point
    for (var obj in surfaces) surfaces[obj].intersects(ray);
    DEBUG = false;
  });

});