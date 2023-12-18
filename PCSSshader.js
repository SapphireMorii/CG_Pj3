//定义了PCSS相关的Shader
const pcssVertexShader_obj = `
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
const pcssFragmentShader_obj = `
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

// Shadow map related variables
#define NUM_SAMPLES 50
#define BLOCKER_SEARCH_NUM_SAMPLES NUM_SAMPLES
#define PCF_NUM_SAMPLES NUM_SAMPLES
#define NUM_RINGS 10

#define EPS 2e-4//4e-4
#define PI 3.141592653589793
#define PI2 6.283185307179586

#define SHADOW_MAP_SIZE 2048.
#define FRUSTUM_SIZE 5000.
#define FILTER_RADIUS 100.//50.
#define LIGHT_WIDTH 60.
#define LIGHT_WIDTH_UV LIGHT_WIDTH/FRUSTUM_SIZE
#define NEAR_PLANE 0.01//-20.

highp float rand_2to1(vec2 uv ) { 
  // 0 - 1
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}

float unpack(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
    return dot(rgbaDepth, bitShift);
}

vec2 poissonDisk[NUM_SAMPLES];

void poissonDiskSamples( const in vec2 randomSeed ) {

  float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
  float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

  float angle = rand_2to1( randomSeed ) * PI2;
  float radius = INV_NUM_SAMPLES;
  float radiusStep = radius;

  for( int i = 0; i < NUM_SAMPLES; i ++ ) {
    poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
    radius += radiusStep;
    angle += ANGLE_STEP;
  }
}

float findBlocker( sampler2D shadowMap,  vec2 uv, float zReceiver ) {
  int block_num = 0;
  float block_depth = 0.;
  float zfromLight = v_PositionFromLight.z;
  float regionsize = LIGHT_WIDTH_UV * (zfromLight + 200.0 - NEAR_PLANE) / (zfromLight + 200.0);

  poissonDiskSamples(uv);
  for(int i = 0;i<NUM_SAMPLES;i++)
  {
    float depth = unpack(texture2D(shadowMap,uv+poissonDisk[i]*regionsize));
    if(depth < zReceiver + EPS)
    {
      block_num++;
      block_depth += depth;
    }
  }
  if(block_num == 0)
  {
    return -1.;
  }
	return block_depth/float(block_num);
}

float PCF(sampler2D shadowMap, vec4 coords, float filterSize) {
  poissonDiskSamples(coords.xy);
  float nonvisibility = 0.0;
  for(int i = 0;i < NUM_SAMPLES;i++)
  {
    vec2 offset = poissonDisk[i] * filterSize;
    vec4 off_coord = coords + vec4(offset,0.0,0.0);
    float depth = unpack(texture2D(shadowMap,off_coord.xy));
    float cur_depth = off_coord.z;
    if(cur_depth > depth + EPS)
    {
      nonvisibility++;
    }
  }
  return 1.0 - nonvisibility/float(NUM_SAMPLES);
}

float PCSS(sampler2D shadowMap, vec4 coords){

  // STEP 1: avgblocker depth
  float zReceiver = coords.z;
  float blocker_depth = findBlocker(shadowMap,coords.xy,zReceiver);
  if(blocker_depth < -EPS) return 1.0;
  // STEP 2: penumbra size
  float Penumbra_w = LIGHT_WIDTH_UV * (zReceiver - blocker_depth) /  blocker_depth;
  // STEP 3: filtering
  return PCF(shadowMap,coords,Penumbra_w);

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

    //visibility = useShadowMap(u_ShadowMap, vec4(shadowCoord, 1.0));
    visibility = PCSS(u_ShadowMap, vec4(shadowCoord, 1.0));

    // gamma 矫正 
    //gl_FragColor = vec4(pow((ambient + diffuse + specular), vec3(1.0/2.2)), 1.0);
    gl_FragColor = vec4((diffuse + specular)*visibility+ambient+diffuse_p+specular_p, 1.0);

}
`

const pcssFragmentShader_texture = `
#ifdef GL_ES
precision mediump float;
#endif
uniform sampler2D u_Sampler;
varying vec2 v_TexCoord;

uniform sampler2D u_ShadowMap;
varying vec4 v_PositionFromLight;

// Shadow map related variables
#define NUM_SAMPLES 50
#define BLOCKER_SEARCH_NUM_SAMPLES NUM_SAMPLES
#define PCF_NUM_SAMPLES NUM_SAMPLES
#define NUM_RINGS 10

#define EPS 2e-4//4e-4
#define PI 3.141592653589793
#define PI2 6.283185307179586

#define SHADOW_MAP_SIZE 2048.
#define FRUSTUM_SIZE 5000.
#define FILTER_RADIUS 100.//50.
#define LIGHT_WIDTH 60.
#define LIGHT_WIDTH_UV LIGHT_WIDTH/FRUSTUM_SIZE
#define NEAR_PLANE 0.01

highp float rand_2to1(vec2 uv ) { 
  // 0 - 1
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract(sin(sn) * c);
}

float unpack(vec4 rgbaDepth) {
  const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
  return dot(rgbaDepth, bitShift);
}

vec2 poissonDisk[NUM_SAMPLES];

void poissonDiskSamples( const in vec2 randomSeed ) {

  float ANGLE_STEP = PI2 * float( NUM_RINGS ) / float( NUM_SAMPLES );
  float INV_NUM_SAMPLES = 1.0 / float( NUM_SAMPLES );

  float angle = rand_2to1( randomSeed ) * PI2;
  float radius = INV_NUM_SAMPLES;
  float radiusStep = radius;

  for( int i = 0; i < NUM_SAMPLES; i ++ ) {
    poissonDisk[i] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
    radius += radiusStep;
    angle += ANGLE_STEP;
  }
}

float findBlocker( sampler2D shadowMap,  vec2 uv, float zReceiver ) {
  int block_num = 0;
  float block_depth = 0.;
  float zfromLight = v_PositionFromLight.z;
  float regionsize = LIGHT_WIDTH_UV * (zfromLight + 200.0 - NEAR_PLANE) / (zfromLight + 200.0);

  poissonDiskSamples(uv);
  for(int i = 0;i<NUM_SAMPLES;i++)
  {
    float depth = unpack(texture2D(shadowMap,uv+poissonDisk[i]*regionsize));
    if(depth < zReceiver + EPS)
    {
      block_num++;
      block_depth += depth;
    }
  }
  if(block_num == 0)
  {
    return -1.;
  }
	return block_depth/float(block_num);
}

float PCF(sampler2D shadowMap, vec4 coords, float filterSize) {
  poissonDiskSamples(coords.xy);
  float nonvisibility = 0.0;
  for(int i = 0;i < NUM_SAMPLES;i++)
  {
    vec2 offset = poissonDisk[i] * filterSize;
    vec4 off_coord = coords + vec4(offset,0.0,0.0);
    float depth = unpack(texture2D(shadowMap,off_coord.xy));
    float cur_depth = off_coord.z;
    if(cur_depth > depth + EPS)
    {
      nonvisibility++;
    }
  }
  return 1.0 - nonvisibility/float(NUM_SAMPLES);
}

float PCSS(sampler2D shadowMap, vec4 coords){

  // STEP 1: avgblocker depth
  float zReceiver = coords.z;
  float blocker_depth = findBlocker(shadowMap,coords.xy,zReceiver);
  if(blocker_depth < -EPS) return 1.0;
  // STEP 2: penumbra size
  float Penumbra_w = LIGHT_WIDTH_UV * (zReceiver - blocker_depth) /  blocker_depth;
  // STEP 3: filtering
  return PCF(shadowMap,coords,Penumbra_w);

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

void main() {

  float visibility;
  vec3 shadowCoord = v_PositionFromLight.xyz / v_PositionFromLight.w;
  shadowCoord.xyz = (shadowCoord.xyz + 1.0) / 2.0;
  //visibility = useShadowMap(u_ShadowMap, vec4(shadowCoord, 1.0));
  visibility = PCSS(u_ShadowMap, vec4(shadowCoord, 1.0));

  gl_FragColor = vec4(texture2D(u_Sampler, v_TexCoord).xyz * visibility,1.0);
}
`