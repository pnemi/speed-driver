const SPRITE_TYPE = {
  OBSTACLE: 2,
  SLOW_VEHICLE: 3,
  FAST_VEHICLE: 4
}

const sprites = {
  "road": {
    x: 262,
    y: 2,
    w: 169,
    h: 154
  },
  "car": {
    x: 352,
    y: 160,
    w: 40,
    h: 66
  },
  "car_crashed": {
    x: 396,
    y: 174,
    w: 40,
    h: 66
  },
  "explosion_0": {
    x: 396,
    y: 161,
    w: 16,
    h: 14
  },
  "explosion_1": {
    x: 480,
    y: 276,
    w: 22,
    h: 26
  },
  "explosion_2": {
    x: 163,
    y: 482,
    w: 24,
    h: 28
  },
  "explosion_3": {
    x: 384,
    y: 244,
    w: 36,
    h: 38
  },
  "explosion_4": {
    x: 80,
    y: 452,
    w: 40,
    h: 40
  },
  "explosion_5": {
    x: 440,
    y: 240,
    w: 38,
    h: 40
  },
  "explosion_6": {
    x: 120,
    y: 452,
    w: 38,
    h: 42
  },
  "obstacle": {
    type: SPRITE_TYPE.OBSTACLE,
    x: 177,
    y: 132,
    w: 48,
    h: 18
  },
  "yellow_car": {
    type: SPRITE_TYPE.FAST_VEHICLE,
    x: 440,
    y: 175,
    w: 40,
    h: 62,
    speedCoeff: 0.8
  },
  "purple_car": {
    type: SPRITE_TYPE.SLOW_VEHICLE,
    x: 352,
    y: 228,
    w: 30,
    h: 46,
    speedCoeff: 0.4
  },
  "green_car": {
    type: SPRITE_TYPE.FAST_VEHICLE,
    x: 44,
    y: 452,
    w: 34,
    h: 46,
    speedCoeff: 0.75
  },
  "orange_truck": {
    type: SPRITE_TYPE.SLOW_VEHICLE,
    x: 436,
    y: 88,
    w: 46,
    h: 84,
    speedCoeff: 0.35
  },
  "blue_truck": {
    type: SPRITE_TYPE.SLOW_VEHICLE,
    x: 436,
    y: 0,
    w: 46,
    h: 84,
    speedCoeff: 0.35
  },
  "life_indicator": {
    x: 4,
    y: 456,
    w: 32,
    h: 42
  },
  "left_sideways_1": {
    x: 4,
    y: 134,
    w: 78,
    h: 154
  },
  "left_sideways_2": {
    x: 92,
    y: 134,
    w: 78,
    h: 154
  },
  "left_sideways_3": {
    x: 4,
    y: 294,
    w: 78,
    h: 154
  },
  "left_sideways_4": {
    x: 92,
    y: 294,
    w: 78,
    h: 154
  },
  "right_sideways_1": {
    x: 180,
    y: 162,
    w: 78,
    h: 154
  },
  "right_sideways_2": {
    x: 268,
    y: 162,
    w: 78,
    h: 154
  },
  "right_sideways_3": {
    x: 180,
    y: 322,
    w: 78,
    h: 154
  },
  "right_sideways_4": {
    x: 268,
    y: 322,
    w: 78,
    h: 154
  }
};
export {
  sprites, SPRITE_TYPE
};
