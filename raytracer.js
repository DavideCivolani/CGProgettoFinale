"use strict";
//prova

var filename = "assets/FullTest.json";

//ALIAS UTILI
var Vector3 = glMatrix.vec3;
var Matrix4 = glMatrix.mat4;

//CORE VARIABLES
var canvas;
var context;
var imageBuffer;

var DEBUG = false; //whether to show debug messages
var EPSILON = 0.00001; //error margins

//scene to render
var scene;
var camera;
var surfaces = [];
var materials;
var aspect;
//etc...

//CLASSES PROTOTYPES
class Camera {
  constructor(eye,up,at) {
    this.eye = Vector3.fromValues(eye[0],eye[1],eye[2]);   // Posizione della camera
    this.up = Vector3.fromValues(up[0],up[1],up[2]);     // Inclinazione testa
    this.at = Vector3.fromValues(at[0],at[1],at[2]);     // Direzione dello sguardo ??

    //Ricavo il camera frame {u,v,w} dai vettori eye,at,up (lezione 8, slide 19)
    //Il camera frame è necessario per usare le formule nel calcolo delle intersezioni
    this.w = Vector3.normalize([], Vector3.scale([], this.at, -1)); // - normalize(at);
    this.u = Vector3.normalize([], Vector3.cross([], this.up, this.w)); //normalize(up * w)
    this.v = Vector3.cross([], this.w, this.u); //w * u;

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
    /* //Implementa formulaccia sul file "Ray Tracing in a Weekend"
    var oc = Vector3.subtract([], ray.getOrigin(), this.center); //r.origin - this.center
    var a = Vector3.dot([], r.getDirection(), r.getDirection());
    var b = 2 * Vector3.dot([], oc, r.getDirection()); //2* oc *dot* r.direction
    
    var ocdotoc = Vector3.dot([], oc, oc);
    var rcrossr = Vector3.cross([], this.radius, this.radius);
    var c = Vector3.subtract([], ocdotoc, rcrossr); //oc *dot* oc - radius * radius

    //Calcolo delta --> dot o cross???
    //var delta = Vector3.dot([], b, b) - 4*Vector3.dot([], a,c); //bb - 4ac
    var delta = b*b - a*c;

    var t,p,normal;
    if (delta > 0) {
      t = -b - Math.sqrt(delta) / (2.0*a);
      if (t > EPSILON) {
        p = ray.pointAtParameter(t);
        normal = Vector3.scale([], Vector3.subtract([],p,this.center), 1/radius); //normale alla sup della sfera: (hit - center) /radius
        
        return new Intersection(t,p,normal);
      }
      
      t = -b + Math.sqrt(delta) / (2.0*a);
      if (t > EPSILON) {
        p = ray.pointAtParameter(t);
        normal = Vector3.scale([], Vector3.subtract([],p,this.center), 1/radius); //normale alla sup della sfera: (hit - center) /radius
        
        return new Intersection(t,p,normal);
      }
    }
    return false; */
    
    //Implementa formula sulle slide del prof
    var p = Vector3.subtract([], ray.getOrigin(), this.center); //e - c
    var d = ray.getDirection();
    var ddotp = Vector3.dot([], d,p);
    var psquare = Vector3.dot([], p, p);
    var dsquare = Vector3.dot([], d, d);

    var t1 = (-ddotp + Math.sqrt(ddotp*ddotp - dsquare*(psquare - this.radius*this.radius))) / dsquare;
    var t2 = (-ddotp - Math.sqrt(ddotp*ddotp - dsquare*(psquare - this.radius*this.radius))) / dsquare;

    //Quale dei due usiamo??

  }
  
  hitSurface(ray) { //wrapper per debug
    return intersects(ray);
  }
}

class Triangle {
  constructor(p1, p2, p3, material) {
    this.p1 = p1;
    this.p2 = p2;
    this.p3 = p3;
    this.material = material;
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


}


//loads and "parses" the scene file at the given path
function loadSceneFile(filepath) {
  scene = Utils.loadJSON(filepath); //load the scene

  // console.log(scene.camera); loading is ok

  //TODO - set up camera
  //set up camera
  aspect = scene.camera.aspect;
  camera = new Camera(scene.camera.eye, scene.camera.up, scene.camera.at);
  camera.makeViewMatrix();

  //TODO - set up surfaces
  for (var i = 0; i < scene.surfaces.length; i++) {

    if (scene.surfaces[i].shape == "Sphere") {
      surfaces.push(new Sphere(scene.surfaces[i].center, scene.surfaces[i].radius, scene.surfaces[i].materials));
    }
    if (scene.surfaces[i].shape == "Triangle") {
      surfaces.push(new Triangle(scene.surfaces[i].p1, scene.surfaces[i].p2, scene.surfaces[i].p3, scene.surfaces[i].material));
    }

  }

  render(); //render the scene

}


//renders the scene
function render() {
  var h,w,u,v,s;
  var start = Date.now(); //for logging
  h = 2*Math.tan(rad(scene.camera.fovy/2.0));
  w = h * aspect;

  for (var i = 0; i <= canvas.width;  i++) { //indice bordo sinistro se i=0 (bordo destro se i = nx-1)
    for (var j = 0; j <= canvas.height; j++) {
      u = (w*i/(canvas.width-1)) - w/2.0;
      v = (-h*j/(canvas.height-1)) + h/2.0;

      //TODO - fire a ray though each pixel
      var ray = camera.castRay(u,v);

      //TODO - calculate the intersection of that ray with the scene
      //var hitSurface,t = s.intersect(ray,EPSILON,+inf);

      //TODO - set the pixel to be the color of that intersection (using setPixel() method)
      //if (hitSurface) imageBuffer.setPixel(u,v,white)

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
  render();

  //load and render new scene
  $('#load_scene_button').click(function(){
    var filepath = 'assets/'+$('#scene_file_input').val()+'.json';
    loadSceneFile(filepath);
  });

  //debugging - cast a ray through the clicked pixel with DEBUG messaging on
  $('#canvas').click(function(e){
    var x = e.pageX - $('#canvas').offset().left;
    var y = e.pageY - $('#canvas').offset().top;
    DEBUG = true;
    u = (w*x/(canvas.width-1)) - w/2.0;
    v = (-h*y/(canvas.height-1)) + h/2.0;
    camera.castRay(u,v); //cast a ray through the point
    DEBUG = false;
  });

});