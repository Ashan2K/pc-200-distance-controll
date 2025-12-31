
export const SENSOR_KB = {
 eng_wtr_temp: {
    unit: "°C",
    normal: [80, 110],
    warning: 102,
    critical: 105,
    type: "upper"
  },

  hydraulic_oil_temperature: {
    unit: "°C",
    normal: [0, 100],
    warning: 102,
    critical: 105,
    type: "upper"
  },

  travel_lf_prs: {
    unit: "kPa",
    normal: [133, 150],
    critical_low: 103,
    type: "lower"
  },

  fuel_lvl: {
    unit: "L",
    warning: 20,
    critical: 10,
    type: "lower"
  },

  arm_dig_prs: {
    unit: "MPa",
    normal: [33.0, 39.7],
    type: "range"
  },

  bucket_dump_prs: {
    unit: "MPa",
    normal: [36.7, 39.7],
    type: "range"
  }
};
