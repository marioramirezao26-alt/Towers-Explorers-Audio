// Firmware del "cuerpo" físico de Gaby: un Stack-chan (M5Stack Core2 + cuello de
// 2 servos) que muestra una carita animada (librería M5Stack-Avatar) y le manda
// tus pedidos a la Cloud Function `deviceCommand` del backend de Gaby.
//
// v1: al presionar el botón A se manda un mensaje de prueba fijo. La idea es
// reemplazar `sendCommand(...)` por lo que reconozca un micrófono más adelante —
// por ahora esto solo prueba que el robot físico y el backend de Gaby se hablan.
#include <M5Unified.h>
#include <Avatar.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include "secrets.h"

using namespace m5avatar;

// Ajusta estos pines según cómo hayas cableado tu kit de cuello — varían según el
// kit/adaptador que uses (Port C, un PbHub, etc.), estos son solo un punto de partida.
#define NECK_PAN_PIN 13
#define NECK_TILT_PIN 14

Avatar avatar;
Servo neckPan;
Servo neckTilt;

enum class RobotState { Idle, Thinking, Speaking, Error };
RobotState state = RobotState::Idle;
unsigned long stateChangedAt = 0;

void setNeck(int panDeg, int tiltDeg) {
  neckPan.write(constrain(panDeg, 0, 180));
  neckTilt.write(constrain(tiltDeg, 0, 180));
}

/** Vuelve a un estado neutral después de mostrar una respuesta/error un rato. */
void goIdle() {
  state = RobotState::Idle;
  stateChangedAt = millis();
  avatar.setExpression(Expression::Neutral);
  avatar.setSpeechText("");
}

/** Manda `message` a la Cloud Function deviceCommand y reacciona con la respuesta. */
void sendCommand(const String& message) {
  state = RobotState::Thinking;
  stateChangedAt = millis();
  avatar.setExpression(Expression::Doubt);
  avatar.setSpeechText("Pensando...");

  if (WiFi.status() != WL_CONNECTED) {
    state = RobotState::Error;
    stateChangedAt = millis();
    avatar.setExpression(Expression::Sad);
    avatar.setSpeechText("Sin WiFi.");
    return;
  }

  WiFiClientSecure client;
  // Simplificado para el primer prototipo: no valida el certificado del servidor.
  // Para endurecerlo más adelante, usa client.setCACert(...) con el certificado
  // raíz de Google Trust Services (el que usa *.cloudfunctions.net).
  client.setInsecure();

  HTTPClient http;
  http.begin(client, GABY_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-secret", DEVICE_SHARED_SECRET);

  JsonDocument body;
  body["workspaceId"] = GABY_WORKSPACE_ID;
  body["message"] = message;
  String payload;
  serializeJson(body, payload);

  int statusCode = http.POST(payload);

  if (statusCode == 200) {
    JsonDocument response;
    deserializeJson(response, http.getString());
    const char* reply = response["reply"] | "No entendí la respuesta.";
    state = RobotState::Speaking;
    stateChangedAt = millis();
    avatar.setExpression(Expression::Happy);
    avatar.setSpeechText(reply);
  } else {
    state = RobotState::Error;
    stateChangedAt = millis();
    avatar.setExpression(Expression::Sad);
    avatar.setSpeechText(("Error del servidor: " + String(statusCode)).c_str());
  }

  http.end();
}

void connectWiFi() {
  avatar.setSpeechText("Conectando WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) {
    avatar.setSpeechText("Listo, hola.");
  } else {
    avatar.setExpression(Expression::Sad);
    avatar.setSpeechText("No pude conectar el WiFi.");
  }
}

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);

  avatar.init();
  avatar.setExpression(Expression::Neutral);

  neckPan.attach(NECK_PAN_PIN);
  neckTilt.attach(NECK_TILT_PIN);
  setNeck(90, 90);

  connectWiFi();
  delay(1500);
  goIdle();
}

void loop() {
  M5.update();

  // Botón A: manda un pedido de prueba. Reemplaza este texto fijo por lo que
  // capture un micrófono cuando se agregue esa parte.
  if (M5.BtnA.wasPressed()) {
    sendCommand("¿qué hora es?");
  }

  // Vuelve a neutral unos segundos después de mostrar una respuesta o error.
  if ((state == RobotState::Speaking || state == RobotState::Error) && millis() - stateChangedAt > 6000) {
    goIdle();
  }

  // Movimiento ambiental del cuello mientras está en reposo, para que no se sienta
  // congelado — un vaivén suave con el tiempo.
  if (state == RobotState::Idle) {
    float t = millis() / 1000.0f;
    int pan = 90 + (int)(10 * sin(t * 0.5f));
    int tilt = 90 + (int)(4 * sin(t * 0.8f));
    setNeck(pan, tilt);
  }

  delay(30);
}
