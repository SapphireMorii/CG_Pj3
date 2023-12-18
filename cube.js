
"use strict";

class CubeLoader {

  constructor(entity, config) {
    this.entity = entity;
    this.gl = config.gl;
  }

  init() {
    this.initShaders();

    this.initshadowshaders();

    this.initBuffers();

    this.initPerspective();

    return this;
  }

  initShaders() {
    // Vertex shader program
    let VSHADER_SOURCE = `
            attribute vec4 a_Position;
            attribute vec4 a_Color;
            uniform mat4 u_MvpMatrix;
            varying vec4 v_Color;

            void main() {
              gl_Position = u_MvpMatrix * a_Position;
              v_Color = a_Color;
            }`;

    // Fragment shader program
    let FSHADER_SOURCE = `
            #ifdef GL_ES
            precision mediump float;
            #endif
            varying vec4 v_Color;
            void main() {
              gl_FragColor = v_Color;
            }`;

    // Initialize shaders
    this.program = createProgram(this.gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!this.program) {
      console.log('Failed to create program');
      return;
    }

    this.gl.useProgram(this.program);
    this.gl.program = this.program;
  }

  initshadowshaders()
  {
    
    this.shadowprogram = createProgram(this.gl,SHADOW_VSHADER_SOURCE,SHADOW_FSHADER_SOURCE);
    this.a_Position_shadow = this.gl.getAttribLocation(this.shadowprogram,'a_Position');
    this.u_MvpMatrix_shadow = this.gl.getUniformLocation(this.shadowprogram,'u_MvpMatrix');
  }

  initPerspective() {
    this.gl.enable(this.gl.DEPTH_TEST);
    // Get the storage location of u_MvpMatrix
    this.u_MvpMatrix = this.gl.getUniformLocation(this.gl.program, 'u_MvpMatrix');
    if (!this.u_MvpMatrix) {
      console.log('Failed to get the storage location of u_MvpMatrix');
    }


    this.g_normalMatrix = new Matrix4();
    // Assign the buffer object to a_Position and enable the assignment
    this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
    this.a_Color = this.gl.getAttribLocation(this.gl.program,'a_Color')

    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.g_modelMatrix = new Matrix4();
    this.g_modelMatrix.translate(this.entity.translate[0], this.entity.translate[1], this.entity.translate[2]);
    this.g_modelMatrix.scale(this.entity.scale[0], this.entity.scale[1], this.entity.scale[2]);

  }

  initBuffers() {
    // Write the vertex coordinates to the buffer object
    this.vertexColorBuffer = this.gl.createBuffer();

    // Write the indices to the buffer object
    this.vertexIndexBuffer = this.gl.createBuffer();
  }

  render() {
    this.gl.useProgram(this.program);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexColorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.vertex), this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 24, 0);
    this.gl.enableVertexAttribArray(this.a_Position);

    this.gl.vertexAttribPointer(this.a_Color, 3, this.gl.FLOAT, false, 24, 12);
    this.gl.enableVertexAttribArray(this.a_Color);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);


    // Set the eye point and the viewing volume
    this.mvpMatrix = Camera.getMatrix();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, this.mvpMatrix.elements);

    this.g_normalMatrix.setInverseOf(this.g_modelMatrix);
    this.g_normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, this.g_normalMatrix.elements);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);



    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }

  rendershadowmap()
  {
    this.gl.useProgram(this.shadowprogram);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexColorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.vertex), this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position_shadow, 3, this.gl.FLOAT, false, 24, 0);
    this.gl.enableVertexAttribArray(this.a_Position_shadow);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);

    // Set the eye point and the viewing volume
    this.mvpMatrix = ShadowLoader.getDirectLightMatrix();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.u_MvpMatrix_shadow, false, this.mvpMatrix.elements);

    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }
}

