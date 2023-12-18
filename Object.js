

"use strict";
class ObjectLoader {
  constructor(entity, config) {
    this.gl = config.gl;
    this.entity = entity;
  }

  init() {

    this.initShaders();

    this.initshadowshaders();

    this.initPerspective();

    this.g_objDoc = null;      // The information of OBJ file
    this.g_drawingInfo = null; // The information for drawing 3D model


    // Prepare empty buffer objects for vertex coordinates, colors, and normals
    this.initBuffers();
    if (!this.buffers) {
      console.log('Failed to set the vertex information');
      return;
    }

    // Start reading the OBJ file
    this.readOBJFile(`${this.entity.objFilePath}`, this.buffers, 1, true);

    return this;
  }

  initShaders() {
    // Vertex shader program
    let VSHADER_SOURCE = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        attribute vec4 a_Normal;
        uniform mat4 u_MvpMatrix;
        uniform mat4 u_ModelMatrix;
        uniform mat4 u_NormalMatrix;
        varying vec4 v_Color;
        uniform vec3 u_Color;
        uniform vec3 u_LightDirection;
        uniform vec3 u_AmbientLight;

        uniform vec3 u_PointLightPosition;
        uniform vec3 u_PointLightColor;

        void main() {
          gl_Position = u_MvpMatrix * a_Position;

          vec4 normal1 = u_NormalMatrix * a_Normal;

          vec3 normal = normalize(normal1.xyz);

          float nDotL = max(dot(u_LightDirection, normal), 0.0);
          vec3 u_DiffuseLight = vec3(1.0, 1.0, 1.0);
          vec3 diffuse = u_DiffuseLight * u_Color * nDotL;
          vec3 ambient = u_AmbientLight * u_Color;
          
          vec4 vertexPosition = u_ModelMatrix * a_Position;
          vec3 PointlightDirection = normalize(u_PointLightPosition-vec3(vertexPosition));
          float nDotPL = max(dot(PointlightDirection,normal),0.0);
          diffuse += u_PointLightColor * u_Color * nDotPL;

          v_Color = vec4(diffuse + ambient, a_Color.a);
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
    // 实现blinn-Phong和阴影效果的shader
    const PhongVertexShader = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        attribute vec4 a_Normal;
        
        uniform mat4 u_ModelMatrix;
        uniform mat4 u_MvpMatrix;
        uniform mat4 u_NormalMatrix;

        varying highp vec4 v_Color;
        varying highp vec3 v_Position;
        varying highp vec3 v_Normal;
        uniform vec3 u_Color;

        //for shadow
        uniform mat4 u_lightMvp;
        varying highp vec4 v_PositionFromLight;

        void main(void) {
          gl_Position = u_MvpMatrix * a_Position;
          v_Position = vec3(u_ModelMatrix * a_Position);
          v_Normal = normalize(vec3(u_NormalMatrix * a_Normal));
          v_Color = vec4(u_Color, a_Color.a);
          //for shadow
          v_PositionFromLight = u_lightMvp * a_Position;
        }
        `;
    const PhongFragmentShader = `
        #ifdef GL_ES
        precision mediump float;
        #endif
        uniform vec3 u_LightDirection;
        uniform vec3 u_AmbientLight;
        varying highp vec3 v_Normal;
        varying highp vec3 v_Position;
        varying highp vec4 v_Color;
        uniform vec3 u_PointLightPosition;
        uniform vec3 u_PointLightColor;
        
        uniform sampler2D u_ShadowMap;
        varying highp vec4 v_PositionFromLight;

        #define EPS 4e-4

        float unpack(vec4 rgbaDepth) {
          const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
          return dot(rgbaDepth, bitShift);
        }
        float useShadowMap(sampler2D shadowMap, vec4 shadowCoord){
          float depth = unpack(texture2D(shadowMap,shadowCoord.xy));
          float cur_depth = shadowCoord.z;
          if(cur_depth > depth + EPS)
          {
            return 0.0;
          }else
          {
            return 1.0;
          }
        }

        void main(void) {

          vec3 u_Ks = vec3(0.7,0.7,0.7);
          //vec3 u_LightColor = vec3(0.8, 0.8, 0.8);
          vec3 u_LightColor = vec3(1.0, 1.0, 1.0);
          
          vec3 u_CameraPos = u_PointLightPosition;
                
          vec3 ambient = u_AmbientLight * v_Color.rgb;
  
          vec3 PointlightDirection = normalize(u_PointLightPosition - v_Position);
          vec3 lightDirection = u_LightDirection;

          vec3 normal = normalize(v_Normal);

          float diff1 = max(dot(PointlightDirection, normal), 0.0);
          float diff2 = max(dot(lightDirection, normal), 0.0);
          vec3 light_atten_coff = u_PointLightColor / length(u_PointLightPosition - v_Position);
          //vec3 diffuse =  diff1 * light_atten_coff * v_Color.rgb + diff2 * u_LightColor * v_Color.rgb;
          vec3 diffuse =  diff2 * u_LightColor * v_Color.rgb;
          vec3 diffuse_p = diff1 * light_atten_coff * v_Color.rgb;

          vec3 viewDir = normalize(u_CameraPos - v_Position);

          vec3 reflectDir1 = reflect(-PointlightDirection, normal);
          vec3 reflectDir2 = reflect(-lightDirection, normal);
          float spec1 = pow (max(dot(viewDir, reflectDir1), 0.0), 35.0);
          float spec2 = pow (max(dot(viewDir, reflectDir2), 0.0), 35.0);
          //vec3 specular = u_Ks * light_atten_coff * spec1 + u_Ks * u_LightColor * spec2;  
          vec3 specular = u_Ks * u_LightColor * spec2;  
          vec3 specular_p = u_Ks * light_atten_coff * spec1;

          float visibility;
          vec3 shadowCoord = v_PositionFromLight.xyz / v_PositionFromLight.w;
          shadowCoord.xyz = (shadowCoord.xyz + 1.0) / 2.0;
          visibility = useShadowMap(u_ShadowMap, vec4(shadowCoord, 1.0));

          // gamma 矫正 
          //gl_FragColor = vec4(pow((ambient + diffuse + specular), vec3(1.0/2.2)), 1.0);
          gl_FragColor = vec4((diffuse + specular)*visibility+ambient+diffuse_p+specular_p, 1.0);
        
        }
        `;


    // Initialize shaders
    //this.program = createProgram(this.gl, PhongVertexShader, PhongFragmentShader);
    this.program = createProgram(this.gl, pcssVertexShader_obj, pcssFragmentShader_obj);

    this.gl.enable(this.gl.DEPTH_TEST);

    // Get the storage locations of attribute and uniform variables
    this.a_Position = this.gl.getAttribLocation(this.program, 'a_Position');
    this.a_Color = this.gl.getAttribLocation(this.program, 'a_Color');
    this.a_Normal = this.gl.getAttribLocation(this.program, 'a_Normal');
    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.u_NormalMatrix = this.gl.getUniformLocation(this.program, 'u_NormalMatrix');
    this.u_ModelMatrix = this.gl.getUniformLocation(this.program, 'u_ModelMatrix');


    this.u_LightDirection = this.gl.getUniformLocation(this.program, 'u_LightDirection');
    this.u_AmbientLight = this.gl.getUniformLocation(this.program, 'u_AmbientLight');
    this.u_Color = this.gl.getUniformLocation(this.program, 'u_Color');

    this.u_PointLightColor = this.gl.getUniformLocation(this.program, 'u_PointLightColor');
    this.u_pointLightPosition = this.gl.getUniformLocation(this.program, 'u_PointLightPosition');

    this.u_lightMvp = this.gl.getUniformLocation(this.program, 'u_lightMvp');
    this.u_ShadowMap = this.gl.getUniformLocation(this.program, 'u_ShadowMap');

    this.gl.useProgram(this.program);
    this.gl.program = this.program;
  }

  initshadowshaders() {

    this.shadowprogram = createProgram(this.gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);
    if (!this.shadowprogram) {
      console.log('Failed to create program');
      return;
    }
    this.a_Position_shadow = this.gl.getAttribLocation(this.shadowprogram, 'a_Position');
    this.u_MvpMatrix_shadow = this.gl.getUniformLocation(this.shadowprogram, 'u_MvpMatrix');
  }

  initPerspective() {
    this.g_modelMatrix = new Matrix4();
    this.g_normalMatrix = new Matrix4();
    for (let t of this.entity.transform) {
      this.g_modelMatrix[t.type].apply(this.g_modelMatrix, t.content);
    }
  }

  initBuffers() {
    // Create a buffer object, assign it to attribute variables, and enable the assignment
    this.buffers = {
      vertexBuffer: this.gl.createBuffer(),
      normalBuffer: this.gl.createBuffer(),
      colorBuffer: this.gl.createBuffer(),
      indexBuffer: this.gl.createBuffer()
    };
  }

  readOBJFile(fileName, model, scale, reverse) {
    let request = new XMLHttpRequest();

    request.onreadystatechange = () => {
      if (request.readyState === 4 && (request.status == 200 || request.status == 0)) {
        this._onReadOBJFile(request.responseText, fileName, model, scale, reverse);
      }
    };
    request.open('GET', fileName, true);
    request.send();
  }


  _onReadOBJFile(fileString, fileName, o, scale, reverse) {
    let objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    let result = objDoc.parse(fileString, scale, reverse); // Parse the file
    if (!result) {
      this.g_objDoc = null;
      this.g_drawingInfo = null;
      console.log("OBJ file parsing error.");
      return;
    }
    this.g_objDoc = objDoc;
  }

  render(timestamp) {
    this.gl.useProgram(this.program);
    this.gl.program = this.program;

    if (this.g_objDoc != null && this.g_objDoc.isMTLComplete()) {
      this.onReadComplete();
    }
    if (!this.g_drawingInfo) return;
    // 如果有动画，调用更新函数
    if (this.hasOwnProperty('nextFrame')) {
      this.nextFrame(timestamp);
      this.initPerspective();
    }

    //let lightDirection = new Vector3([0.15, 0.15, 0.17]);
    let lightDirection = new Vector3(sceneDirectionLight);
    lightDirection.normalize();
    this.gl.uniform3fv(this.u_LightDirection, lightDirection.elements);
    //this.gl.uniform3fv(this.u_AmbientLight, new Vector3([1.2, 1.2, 1.2]).elements);
    this.gl.uniform3fv(this.u_AmbientLight, new Vector3(sceneAmbientLight).elements);

    this.gl.uniform3fv(this.u_Color, new Vector3(this.entity.color).elements);

    if (isPointLight)
      this.gl.uniform3fv(this.u_PointLightColor, new Vector3(scenePointLightColor).elements);
    else
      this.gl.uniform3fv(this.u_PointLightColor, new Vector3([0.0, 0.0, 0.0]).elements);
    this.gl.uniform3fv(this.u_pointLightPosition, new Vector3(CameraPara.at.elements).elements);

    this.g_normalMatrix.setInverseOf(this.g_modelMatrix);
    this.g_normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, this.g_normalMatrix.elements);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);

    let g_mvpMatrix = Camera.getMatrix();
    g_mvpMatrix.concat(this.g_modelMatrix);

    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, g_mvpMatrix.elements);

    g_mvpMatrix = ShadowLoader.getDirectLightMatrix();
    g_mvpMatrix.concat(this.g_modelMatrix);

    this.gl.uniformMatrix4fv(this.u_lightMvp, false, g_mvpMatrix.elements);

    this.gl.uniform1i(this.u_ShadowMap, 2);

    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.g_drawingInfo.indices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  rendershadowmap(timestamp) {
    this.gl.useProgram(this.shadowprogram);
    if (this.g_objDoc != null && this.g_objDoc.isMTLComplete()) {
      this.onReadComplete_shadow();
    }
    if (!this.g_drawingInfo) return;

    if (this.hasOwnProperty('nextFrame')) {
      this.nextFrame(timestamp);
      this.initPerspective();
    }

    let g_mvpMatrix = ShadowLoader.getDirectLightMatrix();
    g_mvpMatrix.concat(this.g_modelMatrix);

    this.gl.uniformMatrix4fv(this.u_MvpMatrix_shadow, false, g_mvpMatrix.elements);
    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.g_drawingInfo.indices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  onReadComplete() {
    // Acquire the vertex coordinates and colors from OBJ file
    this.g_drawingInfo = this.g_objDoc.getDrawingInfo();

    // Write date into the buffer object
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.vertices, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Position);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normalBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.normals, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Normal, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Normal);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.colors, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Color, 4, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Color);

    // Write the indices to the buffer object
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.g_drawingInfo.indices, this.gl.STATIC_DRAW);
  }

  onReadComplete_shadow() {
    this.g_drawingInfo = this.g_objDoc.getDrawingInfo();
    // Write date into the buffer object
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.vertices, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position_shadow, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Position_shadow);

    // Write the indices to the buffer object
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.g_drawingInfo.indices, this.gl.STATIC_DRAW);
  }
}
