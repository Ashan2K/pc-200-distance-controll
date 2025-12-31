class KomatsuSensorData {
  constructor(rawData) {
    this.rawData = rawData;
    this.timestamp = new Date().toISOString();
    this.deviceType = 'komatsu';
  }

  processData() {
    return {
      // Sensor readings
      rad_wtr_lvl: this.rawData.rad_wtr_lvl,
      crank_sen: this.rawData.crank_sen,
      cam_sen: this.rawData.cam_sen,
      air_cln_cld: this.rawData.air_cln_cld,
      wtr_in_fuel: this.rawData.wtr_in_fuel,
      eng_oil_lvl: this.rawData.eng_oil_lvl,
      eng_wtr_temp: this.rawData.eng_wtr_temp,
      boost_prs: this.rawData.boost_prs,
      rail_prs: this.rawData.rail_prs,
      fuel_lvl: this.rawData.fuel_lvl,
      hyd_oil_temp: this.rawData.hyd_oil_temp,
      rear_pump_prs: this.rawData.rear_pump_prs,
      arm_dump_prs: this.rawData.arm_dump_prs,
      arm_dig_prs: this.rawData.arm_dig_prs,
      bucket_dump_prs: this.rawData.bucket_dump_prs,
      bucket_dig_prs: this.rawData.bucket_dig_prs,
      boom_up_prs: this.rawData.boom_up_prs,
      boom_down_prs: this.rawData.boom_down_prs,
      swing_left_prs: this.rawData.swing_left_prs,
      swing_right_prs: this.rawData.swing_right_prs,
      front_pump_prs: this.rawData.front_pump_prs,
      ac_amb_temp: this.rawData.ac_amb_temp,
      sunshine_sen: this.rawData.sunshine_sen,
      amb_air_prs: this.rawData.amb_air_prs,
      travel_lf_prs: this.rawData.travel_lf_prs,
      travel_lr_prs: this.rawData.travel_lr_prs,
      travel_rf_prs: this.rawData.travel_rf_prs,
      travel_rr_prs: this.rawData.travel_rr_prs,
      
      // GPS data
      gps: this.rawData.gps || null,
      
      // Metadata
      timestamp: this.timestamp,
      device_type: this.deviceType
    };
  }

  getCriticalMetrics() {
    return {
      engine_oil_level: this.rawData.eng_oil_lvl,
      fuel_level: this.rawData.fuel_lvl,
      hydraulic_temperature: this.rawData.hyd_oil_temp,
      coolant_temperature: this.rawData.eng_wtr_temp,
      boost_pressure: this.rawData.boost_prs
    };
  }

  getOperationalMetrics() {
    return {
      arm_pressure: this.rawData.arm_dig_prs,
      boom_pressure: this.rawData.boom_up_prs,
      bucket_pressure: this.rawData.bucket_dig_prs,
      swing_pressure: Math.max(
        this.rawData.swing_left_prs || 0,
        this.rawData.swing_right_prs || 0
      ),
      travel_pressure: Math.max(
        this.rawData.travel_lf_prs || 0,
        this.rawData.travel_rf_prs || 0,
        this.rawData.travel_lr_prs || 0,
        this.rawData.travel_rr_prs || 0
      )
    };
  }
}

module.exports = {
  KomatsuSensorData
};