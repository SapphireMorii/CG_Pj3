

"use strict";
class ShadowLoader {
  constructor(config) {
    this.gl = config.gl;
  }
  
  init()
  {
    //this.initShadowShader();
    this.initFramebufferObject();
    this.gl.activeTexture(this.gl.TEXTURE2)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.framebuffer.texture);
    return this;
  }

  initFramebufferObject(){
    var OFFSCREEN_WIDTH = 2048, OFFSCREEN_HEIGHT = 2048;
    var framebuffer, texture, depthBuffer;

    // Define the error handling function
    var error = function () {
      if (framebuffer) this.gl.deleteFramebuffer(framebuffer);
      if (texture) this.gl.deleteTexture(texture);
      if (depthBuffer) this.gl.deleteRenderbuffer(depthBuffer);
      return null;
    }
  
    // Create a framebuffer object (FBO)
    framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      console.log('Failed to create frame buffer object');
      return error();
    }
  
    // Create a texture object and set its size and parameters
    texture = this.gl.createTexture(); // Create a texture object
    if (!texture) {
      console.log('Failed to create texture object');
      return error();
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  
    // Create a renderbuffer object and Set its size and parameters
    depthBuffer = this.gl.createRenderbuffer(); // Create a renderbuffer object
    if (!depthBuffer) {
      console.log('Failed to create renderbuffer object');
      return error();
    }
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthBuffer);
    this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT);
  
    // Attach the texture and the renderbuffer object to the FBO
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, depthBuffer);
  
    // Check if FBO is configured correctly
    var e = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (this.gl.FRAMEBUFFER_COMPLETE !== e) {
      console.log('Frame buffer object is incomplete: ' + e.toString());
      return error();
    }
  
    framebuffer.texture = texture; // keep the required object
  
    // Unbind the buffer object
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
  
    this.framebuffer = framebuffer;
  }
  //获取平行光的mvp矩阵
  static getDirectLightMatrix() {
    return new Matrix4()
        //.ortho(-100.0, 100.0, -100.0, 100.0, -20.0, 1000.0)
        .ortho(-100.0, 100.0, -100.0, 100.0, -200.0, 1000.0)
        .lookAt(sceneDirectionLight[0], sceneDirectionLight[1], sceneDirectionLight[2],
            0, 0, 0,
            0, 1, 0);
  }

}
// Shadowmap shader
// Vertex shader program
const SHADOW_VSHADER_SOURCE = `
attribute vec4 a_Position;

uniform mat4 u_MvpMatrix;

void main(void) {
  gl_Position = u_MvpMatrix * a_Position;
}`;

// Fragment shader program
const SHADOW_FSHADER_SOURCE = `
#ifdef GL_ES
precision mediump float;
#endif
vec4 pack (float depth) {
    // 使用rgba 4字节共32位来存储z值,1个字节精度为1/256
    const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);
    const vec4 bitMask = vec4(1.0/256.0, 1.0/256.0, 1.0/256.0, 0.0);
    // gl_FragCoord:片元的坐标,fract():返回数值的小数部分
    vec4 rgbaDepth = fract(depth * bitShift); //计算每个点的z值
    rgbaDepth -= rgbaDepth.gbaa * bitMask; // Cut off the value which do not fit in 8 bits
    return rgbaDepth;
}

void main(){
  // gl_FragColor = vec4( 1.0, 0.0, 0.0, gl_FragCoord.z);
  gl_FragColor = pack(gl_FragCoord.z);
}`;