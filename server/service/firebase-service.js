const { db, admin } = require('../config/firebase-config');

// ==================== FIREBASE SERVICE FUNCTIONS ====================
class FirebaseService {
  // Store Komatsu sensor data in Firestore
  static async storeKomatsuData(data) {
    try {
      const timestamp = new Date().toISOString();
      
      // Process GPS data to handle "NO FIX" case
      let processedGPS = null;
      if (data.gps && data.gps.status !== 'NO FIX' && data.gps.lat && data.gps.lon) {
        processedGPS = {
          lat: data.gps.lat || 0,
          lon: data.gps.lon || 0,
          speed: data.gps.speed || 0,
          alt: data.gps.alt || 0,
          sats: data.gps.sats || 0,
          utc: data.gps.utc || new Date().toISOString(),
          status: data.gps.status || 'active'
        };
      } else if (data.gps && data.gps.status === 'NO FIX') {
        processedGPS = {
          status: 'NO FIX',
          lat: null,
          lon: null,
          speed: 0,
          alt: 0,
          sats: 0,
          utc: new Date().toISOString()
        };
      }
      
      const documentData = {
        // Sensor readings
        rad_wtr_lvl: data.rad_wtr_lvl || 0,
        crank_sen: data.crank_sen || 0,
        cam_sen: data.cam_sen || 0,
        air_cln_cld: data.air_cln_cld || 0,
        wtr_in_fuel: data.wtr_in_fuel || 0,
        eng_oil_lvl: data.eng_oil_lvl || 0,
        eng_wtr_temp: data.eng_wtr_temp || 0,
        boost_prs: data.boost_prs || 0,
        rail_prs: data.rail_prs || 0,
        fuel_lvl: data.fuel_lvl || 0,
        hyd_oil_temp: data.hyd_oil_temp || 0,
        rear_pump_prs: data.rear_pump_prs || 0,
        arm_dump_prs: data.arm_dump_prs || 0,
        arm_dig_prs: data.arm_dig_prs || 0,
        bucket_dump_prs: data.bucket_dump_prs || 0,
        bucket_dig_prs: data.bucket_dig_prs || 0,
        boom_up_prs: data.boom_up_prs || 0,
        boom_down_prs: data.boom_down_prs || 0,
        swing_left_prs: data.swing_left_prs || 0,
        swing_right_prs: data.swing_right_prs || 0,
        front_pump_prs: data.front_pump_prs || 0,
        ac_amb_temp: data.ac_amb_temp || 0,
        sunshine_sen: data.sunshine_sen || 0,
        amb_air_prs: data.amb_air_prs || 0,
        travel_lf_prs: data.travel_lf_prs || 0,
        travel_lr_prs: data.travel_lr_prs || 0,
        travel_rf_prs: data.travel_rf_prs || 0,
        travel_rr_prs: data.travel_rr_prs || 0,
        
        // GPS data (processed to avoid undefined)
        gps: processedGPS,
        
        // Metadata
        timestamp: timestamp,
        device_type: 'komatsu',
        receivedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Store in main collection with ignoreUndefinedProperties
      const docRef = await db.collection('komatsu_sensor_data').add(documentData);
      
      // Update latest readings
      await this.updateLatestKomatsuReadings(documentData);
      
      // Store GPS data separately if available and valid
      if (processedGPS && processedGPS.status !== 'NO FIX') {
        await this.storeKomatsuGPS(processedGPS);
      }
      
      console.log(`✅ Komatsu data stored with ID: ${docRef.id}`);
      return { success: true, docId: docRef.id };
      
    } catch (error) {
      console.error(`❌ Firebase storage error:`, error);
      throw error;
    }
  }

  // Update latest Komatsu readings
  static async updateLatestKomatsuReadings(data) {
    try {
      await db.collection('latest_readings')
        .doc('komatsu')
        .set({
          ...data,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      
      console.log(`✅ Latest readings updated`);
    } catch (error) {
      console.error(`❌ Latest readings update error:`, error);
    }
  }

  // Store GPS data separately for tracking (only when we have valid GPS)
  static async storeKomatsuGPS(gpsData) {
    try {
      if (!gpsData || gpsData.status === 'NO FIX' || !gpsData.lat || !gpsData.lon) {
        console.log('ℹ️ No valid GPS data to store');
        return;
      }

      const gpsDoc = {
        lat: gpsData.lat,
        lon: gpsData.lon,
        speed: gpsData.speed || 0,
        alt: gpsData.alt || 0,
        sats: gpsData.sats || 0,
        utc: gpsData.utc || new Date().toISOString(),
        device_type: 'komatsu',
        timestamp: new Date().toISOString(),
        receivedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Store in GPS tracking collection
      await db.collection('komatsu_gps_tracking').add(gpsDoc);

      // Update current location
      await db.collection('current_locations')
        .doc('komatsu')
        .set(gpsDoc, { merge: true });

      console.log(`✅ GPS data stored`);
      
    } catch (error) {
      console.error(`❌ GPS storage error:`, error);
    }
  }

  // Validate Komatsu sensor data
  static validateKomatsuData(data) {
    // Check for required fields
    const requiredFields = ['rad_wtr_lvl', 'eng_oil_lvl', 'fuel_lvl', 'hyd_oil_temp'];
    
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        console.warn(`⚠️ Missing required field: ${field}`);
        return false;
      }
    }

    // Validate data types and ranges
    if (data.eng_oil_lvl < 0 || data.eng_oil_lvl > 100) {
      console.warn(`⚠️ Invalid engine oil level: ${data.eng_oil_lvl}`);
      return false;
    }

    if (data.fuel_lvl < 0 || data.fuel_lvl > 100) {
      console.warn(`⚠️ Invalid fuel level: ${data.fuel_lvl}`);
      return false;
    }

    console.log(`✅ Data validation passed`);
    return true;
  }

  // Get critical alerts from sensor data
  static checkAlerts(data) {
    const alerts = [];

    if (data.hyd_oil_temp > 100) {
      alerts.push('High hydraulic oil temperature');
    }

    if (data.eng_oil_lvl < 20) {
      alerts.push('Low engine oil level');
    }

    if (data.fuel_lvl < 15) {
      alerts.push('Low fuel level');
    }

    if (data.rad_wtr_lvl === 0) {
      alerts.push('Radiator water level low');
    }

    // Add GPS alert
    if (data.gps && data.gps.status === 'NO FIX') {
      alerts.push('GPS has no fix');
    }

    if (alerts.length > 0) {
      console.log(`🚨 Alerts detected: ${alerts.join(', ')}`);
    }

    return alerts;
  }
}





module.exports = FirebaseService;