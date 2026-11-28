"use strict";
function drawWinterScene() {
  const canvas = document.getElementById("night");
  const context = canvas.getContext("2d");
  if (!context) return;
  const c = context;

  function polygon(points, color) {
    c.fillStyle = color;
    c.beginPath();
    points.forEach(([x, y], index) => index === 0 ? c.moveTo(x, y) : c.lineTo(x, y));
    c.closePath();
    c.fill();
  }

  const haze = c.createRadialGradient(408, 118, 8, 408, 118, 208);
  haze.addColorStop(0, "#66829c70");
  haze.addColorStop(1, "#23375200");
  c.fillStyle = haze;
  c.fillRect(0, 0, 560, 260);
  c.fillStyle = "#f8dfad";
  c.beginPath();
  c.arc(448, 66, 26, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 62; i++) {
    const x = 82 + ((97 * i) % 464);
    const y = 10 + ((61 * i) % 205);
    c.fillStyle = i % 8 === 0 ? "#fff0c4a8" : "#d7eaff56";
    c.fillRect(x, y, i % 8 === 0 ? 2.5 : 1.5, i % 8 === 0 ? 2.5 : 1.5);
  }

  polygon([[56,260], [149,159], [197,189], [272,111], [331,181], [400,116], [463,176], [513,127], [560,160], [560,260]], "#415b78");
  polygon([[233,155], [272,111], [307,149], [288,148], [277,156], [267,145], [256,152]], "#89a3b6");
  polygon([[372,148], [400,116], [432,150], [412,144], [402,153], [391,146]], "#8aa6bb");
  polygon([[57,260], [157,209], [274,210], [385,191], [560,211], [560,260]], "#67819a");
  polygon([[117,260], [209,232], [327,233], [443,216], [560,234], [560,260]], "#8197ab");

  function pine(x, y, h, shade) {
    c.fillStyle = "#244354";
    c.fillRect(x - 2, y - 8, 5, 10);
    for (let j = 0; j < 3; j++) {
      const height = h * (1 - .18 * j);
      const top = y - h + j * h * .21;
      const width = h * (.18 + .045 * j);
      polygon([[x, top], [x - width, top + height * .61], [x + width, top + height * .61]], shade);
    }
  }
  [[198,235,58],[236,229,41],[276,238,65],[300,229,40],[496,240,79],[529,253,92],[554,244,67]].forEach(([x,y,h], i) => pine(x,y,h,i%2 ? "#294856" : "#203c50"));
  polygon([[322,229],[464,229],[460,239],[312,239]], "#243c5b65");
  c.fillStyle = "#544048";
  c.fillRect(337, 186, 107, 46);
  polygon([[321,188], [384,147], [455,188]], "#783f45");
  polygon([[317,187], [383,143], [461,187], [450,187], [384,151], [329,187]], "#dce8f1");
  c.fillStyle = "#694349";
  c.fillRect(418, 149, 11, 24);
  c.fillStyle = "#f3ddad";
  c.fillRect(417, 147, 13, 5);
  c.fillStyle = "#302f42";
  c.fillRect(382, 200, 20, 32);
  c.fillStyle = "#ffc982";
  c.fillRect(348, 196, 20, 16);
  c.fillRect(415, 196, 21, 16);
  c.fillStyle = "#7d4f43";
  [357,425].forEach((x) => c.fillRect(x, 196, 2, 16));
  [348,415].forEach((x) => c.fillRect(x, 203, 21, 2));
  c.fillStyle = "#ffe8b6";
  c.fillRect(397, 215, 3, 3);
  polygon([[387,232],[397,232],[425,260],[402,260]], "#c5b2a883");

  const fade = c.createLinearGradient(40, 0, 235, 0);
  fade.addColorStop(0, "#000000");
  fade.addColorStop(1, "#00000000");
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = fade;
  c.fillRect(0, 0, 560, 260);
  c.globalCompositeOperation = "source-over";
}

drawWinterScene();
