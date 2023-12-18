
"use strict";

window.onload = () => {
  let canvas = document.getElementById('webgl');
  let positon_text = document.getElementById('position');
  let lookat_text = document.getElementById('lookat');
  canvas.setAttribute("width", 500);
  canvas.setAttribute("height", 500);
  window.ratio = canvas.width / canvas.height;
  let gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Load a new scene
  new SceneLoader(gl, positon_text, lookat_text).init();
};

class SceneLoader {
  constructor(gl, positon_text, lookat_text) {
    this.gl = gl;
    this.position_text = positon_text;
    this.lookat_text = lookat_text;
    this.loaders = [];
    this.shadowLoader = null;
    this.keyboardController = new KeyboardController();
  }

  init() {

    this.initKeyController();

    this.initLoaders();

    let render = (timestamp) => {

      this.initWebGL();

      this.initCamera(timestamp);
      
      //渲染Shadow Map
      this.initShadowMap();
      //this.initColor();

      for (let loader of this.loaders) {
        loader.rendershadowmap(timestamp);
      }
      //渲染场景
      this.initColor();

      for (let loader of this.loaders) {
         loader.render(timestamp);
      }
      
      requestAnimationFrame(render, this.gl);
    };

    render();
  }


  initWebGL() {
    // Set clear color and enable hidden surface removal
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Clear color and depth buffer
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  initKeyController() {
    Camera.init();
    let cameraMap = new Map();
    cameraMap.set('a', 'posLeft');
    cameraMap.set('d', 'posRight');
    cameraMap.set('w', 'posForward');
    cameraMap.set('s', 'posDown');
    cameraMap.set('j', 'rotLeft');
    cameraMap.set('l', 'rotRight');
    cameraMap.set('i', 'rotUp');
    cameraMap.set('k', 'rotDown');

    cameraMap.forEach((val, key)=> {
          this.keyboardController.bind(key, {
            on: (()=> {
              Camera.state[val] = 1;
            }),
            off: (()=> {
              Camera.state[val] = 0;
            })
          });
        }
    )
    this.keyboardController.bind('f',{
      on: (()=> {
        isPointLight = true;
      }),
      off: (()=> {
        isPointLight = false;
      })
    })
  }

  initCamera(timestamp) {
    let elapsed = timestamp - this.keyboardController.last;
    this.keyboardController.last = timestamp;

    let posY = (Camera.state.posRight - Camera.state.posLeft) * MOVE_VELOCITY * elapsed / 1000;
    let posX = (Camera.state.posForward - Camera.state.posDown) * MOVE_VELOCITY * elapsed / 1000;
    let rotY = (Camera.state.rotRight - Camera.state.rotLeft) * ROT_VELOCITY * elapsed / 1000 / 180 * Math.PI;
    let rotX = (Camera.state.rotUp - Camera.state.rotDown) * ROT_VELOCITY * elapsed / 1000 / 180 * Math.PI;

    if (posY) Camera.move(0, posY, this.position_text, this.lookat_text);
    if (posX) Camera.move(posX, 0, this.position_text, this.lookat_text);
    if (rotY) Camera.rotate(0, rotY, this.position_text, this.lookat_text);
    if (rotX) Camera.rotate(rotX, 0, this.position_text, this.lookat_text);
  }

  initLoaders() {
    let shadowLoader = new ShadowLoader({
      'gl':this.gl
    }).init();
    this.shadowLoader = shadowLoader;

    // Load floor
    let floorLoader = new TextureLoader(floorRes, {
      'gl': this.gl,
      'activeTextureIndex': 0,
      'enableLight': true
    }).init();
    this.loaders.push(floorLoader);

    // Load box
    let boxLoader = new TextureLoader(boxRes, {
      'gl': this.gl,
      'activeTextureIndex': 1,
      'enableLight': true
    }).init();
    this.loaders.push(boxLoader);

    // Load cube
    let cubeLoader = new CubeLoader(cubeRes,{
      'gl': this.gl
    }).init();
    this.loaders.push(cubeLoader);

        // Load objects
    for (let o of ObjectList) {
      let loader = new ObjectLoader(o, {'gl': this.gl}).init();
      // Add animation to bird
      if (o.objFilePath.indexOf('bird') > 0) {
        loader.angle = 0; 
        loader.last = 0;
        loader.nextFrame = (timestamp) => {
          let elapsed = timestamp - loader.last;
          loader.last = timestamp;
          var currentAngle = loader.angle + (90 * elapsed) / 1000.0;
          loader.angle = currentAngle;
          loader.entity.transform = [
            {type: "translate", content: [0, 8+4*Math.sin(2*currentAngle*Math.PI/180), -5]},
            {type: "rotate", content: [currentAngle, 0, 1, 0]},
            {type: "translate", content: [0, 0, 5]},
            {type: "scale", content: [5, 5, 5]}
          ]
        }
      }
      this.loaders.push(loader);
    }
  }

  initShadowMap()
  {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.shadowLoader.framebuffer);
    this.gl.viewport(0,0,2048,2048);
    this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  initColor()
  {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER,null);
    this.gl.viewport(0,0,500,500);
    this.gl.clearColor(0.0,0.0,0.0,1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
}
