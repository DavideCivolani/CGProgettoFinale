"use strict";
//prova

var filename = "assets/SphereTest.json";
var test = 0;

//ALIAS UTILI
var Vector3 = glMatrix.vec3;
var Matrix4 = glMatrix.mat4;
var Matrix3 = glMatrix.mat3;

//CORE VARIABLES
var canvas;
var context;
var imageBuffer;
var heigth;
var width;

var DEBUG = false; //whether to show debug messages
var EPSILON = 0.00001; //error margins

//scene to render
var scene;
var camera;
var surfaces = [];
// var materials;
var aspect;

//etc...

//CLASSES PROTOTYPES
class Camera {
  constructor(eye,up,at) {
    this.eye = Vector3.fromValues(eye[0],eye[1],eye[2]);   // Posizione della camera  (e)
    this.up = Vector3.fromValues(up[0],up[1],up[2]);     // Inclinazione testa        (t)
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
  
}

class Triangle {
  constructor(p1, p2, p3, material) {
    this.a = p1; // a
    this.b = p2; // b
    this.c = p3; // c
    this.material = material;
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
    // var B = Matrix3.fromValues(
    //   this.a[0]-ray.a[0],
    //   this.a[1]-ray.a[1],
    //   this.a[2]-ray.a[2]
    // );

    // metodo della inversa
    // var invA = Matrix3.create();
    // Matrix3.invert(invA,A);

    // var x = Matrix3.create();
    // Matrix3.multiply(x, invA, B);
    
    // metodo di cramer come sul libro
    // var M = A[0]*(A[4]*A[8] - A[5]*A[7]) + A[3]*(A[2]*A[7] - A[1]*A[8]) + A[6]*(A[1]*A[5] - A[4]*A[2]);
    // var beta = ( B[0]*(A[4]*A[8] - A[5]*A[7]) + B[1]*(A[2]*A[7] - A[2]*A[8]) + B[2]*(A[1]*A[5] - A[4]*A[2]) )/M;
    // var gamma = ( A[8]*(A[0]*B[1] - B[0]*A[3]) + A[5]*(B[0]*A[6] - A[0]*B[2]) + A[2]*(A[3]*B[2] - B[1]*A[6]) )/M;
    // var t = ( A[7]*(A[0]*B[1] - B[0]*A[3]) + A[4]*(B[0]*A[6] - A[0]*B[2]) + A[1]*(A[3]*B[2] - B[1]*A[6]) )/M;


    
    // metodo trovato online
    var V = new Vector3.create();
    Vector3.subtract(this.b, this.a, V);

    var W = new Vector3.create();
    Vector3.subtract(this.c, this.a, W);
    
    var n = new Vector3.fromValues(V[1]*W[2] - V[2]*W[1],
                                   V[2]*W[0] - V[0]*W[2],
                                   V[0]*W[1] - V[1]*W[0]);
    
    var N = [];
    N[0] = n[0] / (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));
    N[1] = n[1] / (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));
    N[2] = n[2] / (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));

    var D = Vector3.dot(N, this.a);
    var t = - ( Vector3.dot(N, ray.a) + D ) / Vector3.dot(N, ray.dir);

    var P = new Vector3.create();
    P[0] = ray.a[0] + t*ray.dir[0];
    P[1] = ray.a[1] + t*ray.dir[1];
    P[2] = ray.a[2] + t*ray.dir[2];

    var edge0 = new Vector3.create();
    Vector3.subtract(this.b, this.a, edge0);
    var edge1 = new Vector3.create();
    Vector3.subtract(this.c, this.b, edge1);
    var edge2 = new Vector3.create();
    Vector3.subtract(this.a, this.c, edge2);

    var C0 = new Vector3.create();
    Vector3.subtract(P, this.a, C0);
    var C1 = new Vector3.create();
    Vector3.subtract(P, this.b, C1);
    var C2 = new Vector3.create();
    Vector3.subtract(P, this.c, C2);

    var cross0 = new Vector3.create();
    Vector3.cross(edge0, C0, cross0);
    var cross1 = new Vector3.create();
    Vector3.cross(edge1, C1, cross1);
    var cross2 = new Vector3.create();
    Vector3.cross(edge2, C2, cross2);


    if (Vector3.dot(N, cross0) > 0 &&
        Vector3.dot(N, cross1) > 0 &&
        Vector3.dot(N, cross2) > 0) return true;
    else return false;


    // if (test < 10) {
    //   console.log(P);
    //   test++;
    // }

    // if (beta > 0 && gamma > 0 && beta+gamma < 1) { // intersezione
    //   // console.log("ok");
    //   return t;
    // }
    // else return false;
  }
}

//Ray-Intersect
class Ray {
  constructor(a,dir) {
    this.a = a; //origine
    this.dir = dir; //direzione
  }
  
  pointAtParameter(t) {
    //return A + t * d
    var tmp;
    //tmp = Vector3.add([],a,Vector3.scale([],d,t)); //non si capisce niente così
    tmp[0] = this.a + t * dir[0];
    tmp[1] = this.a + t * dir[1];
    tmp[2] = this.a + t * dir[2];
    return tmp;
  };
  
  getOrigin() {return this.a;}
  getDirection() {return this.dir;}
  
}

class Intersection{
  constructor(x,y,z) {
    this.int = new Vector3(x,y,z);
  }

}

//Lighting
class Light{
  constructor() {

  }
}
class PointLight extends Light{
  constructor() {
    super();

  }
}

class AmbientLight extends Light {
  constructor() {
    super();

  }
}

class Material { //Forse è sufficiente usare i file caricati dal json
  constructor() {

  }
}


//initializes the canvas and drawing buffers
function init() {
  canvas = $('#canvas')[0];
  context = canvas.getContext("2d");
  imageBuffer = context.createImageData(canvas.width, canvas.height); //buffer for pixels

  loadSceneFile(filename);

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
  camera.makeViewMatrix(); //a che serve?

  //set up surfaces
  for (var i = 0; i < scene.surfaces.length; i++) {
    if (scene.surfaces[i].shape == "Sphere") {
      surfaces.push(new Sphere(scene.surfaces[i].center, scene.surfaces[i].radius, scene.surfaces[i].materials));
    }
    if (scene.surfaces[i].shape == "Triangle") {
      surfaces.push(new Triangle(scene.surfaces[i].p1, scene.surfaces[i].p2, scene.surfaces[i].p3, scene.surfaces[i].material));
    }

  }

  //set up lights


}


//renders the scene
function render() {
  var h,w,u,v,s;
  var backgroundcolor = [0,0,0];
  var start = Date.now(); //for logging
  h = 2*Math.tan(rad(scene.camera.fovy/2.0));
  w = h * aspect;

  for (var i = 0; i <= canvas.width;  i++) { //indice bordo sinistro se i=0 (bordo destro se i = nx-1)
    for (var j = 0; j <= canvas.height; j++) {
      u = (w*i/(canvas.width-1)) - w/2.0;
      v = (-h*j/(canvas.height-1)) + h/2.0;

      //TODO - fire a ray though each pixel
      var ray = camera.castRay(u, v);
      //if (i < 1 && j< 10) console.log(ray);

      var t = false;
      for (var k = 0; k < surfaces.length; k++) {
        //calculate the intersection of that ray with the scene
        t = surfaces[k].intersects(ray);
        
        //set the pixel to be the color of that intersection (using setPixel() method)
        if (t == false) setPixel(i, j, backgroundcolor);
        else setPixel(i, j, [255,255,255]);
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