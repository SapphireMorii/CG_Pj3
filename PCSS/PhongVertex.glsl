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