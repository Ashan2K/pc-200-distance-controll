import kb from './pc200_knowledge_base.json';
import axios from 'axios';
/**
 * RECOVERY LOGIC:
 * Converts the ESP32 "28-scale" or "105-scale" back to the Manual's units.
 * ESP32 used: (voltage - 0.5) * Multiplier.
 */

const sessionLogs = new Set();



const getPhysicalValue = (val, type, manualMax) => {
    if (val === undefined || val === null) return 0;
    
    let voltage;
    // Reverse the scaling based on your ESP32 multipliers
    if (type === 'temp') {
        // ESP32 used: (v - 0.5) * 37.5. (4.5-0.5)*37.5 = 150 (but your sample shows 105 max)
        voltage = (val / 26.25) + 0.5; 
    } else {
        // ESP32 used: (v - 0.5) * 7.0 or 10.0. For your '28' values:
        voltage = (val / 7.0) + 0.5; 
    }

    if (voltage < 0.55) return 0; // Signal Floor
    return (voltage - 0.5) * (manualMax / 4.0);
};

export const analyzeMachineHealth = async (liveData) => {
    console.log("Analyzing machine health with data:", liveData);
    const status = { errors: [], predictions: [] };
    if (liveData.cam_sen == 0 && liveData.crank_sen == 0) {
        sessionLogs.clear();
        return status;
    }

    const sensor = kb.sensor_definitions;

    const sendToNode = async (sensorKey, physicalVal, errorObj) => {
        const logKey = `${errorObj.code}_${sensorKey}`;
        if (sessionLogs.has(logKey)) return; // Don't log twice

        sessionLogs.add(logKey);
        try {
            await axios.post('http://localhost:3000/api/log-error', {
                errorDetail: {
                    code: errorObj.code,
                    msg: errorObj.msg,
                    sensor: sensorKey,
                    value: physicalVal
                },
                fullSnapshot: liveData // Save all 28 sensors
            });
        } catch (err) {
            console.error("Failed to reach Node server", err);
        }
    };

    // --- 1. ENGINE GROUP ---
    // Eng Water Temp (Mux1 Ch1)
    const engWtrTemp = getPhysicalValue(liveData.eng_wtr_temp, 'temp', 120);
    console.log("Engine Water Temp:", engWtrTemp);
    if (engWtrTemp >= sensor.engine_coolant_temp.ranges.critical) {
        const err = { code: "E03", msg: sensor.engine_coolant_temp.actions.critical };
        status.errors.push({ code: "E03", msg: sensor.engine_coolant_temp.actions.critical });
        //await sendToNode("eng_wtr_temp", engWtrTemp, err, liveData);
    }
    if (engWtrTemp <= sensor.engine_coolant_temp.ranges.low_error[0]) {
        status.errors.push({ code: "E02", msg: sensor.engine_coolant_temp.actions.warning_low });
    }

    // Boost Pressure (Mux1 Ch2) -> 200 kPa scale
    const boostKpa = getPhysicalValue(liveData.boost_prs, 'prs', 200);
    console.log("Boost Pressure:", boostKpa);
    if (boostKpa < 103) { 
        status.errors.push({ code: "E04", msg: sensor.boost_intake_pressure.actions.critical_low });
    }

    // Common Rail (Mux1 Ch3) -> 180 MPa scale
    const railMpa = getPhysicalValue(liveData.rail_prs, 'prs', 180);
    console.log("Common Rail Pressure:", railMpa);
    if (railMpa > 0 && railMpa < 25) {
        status.errors.push({ code: "CA452", msg: sensor.common_rail_fuel_pressure.actions.critical_low });
    }

    // --- 2. HYDRAULIC GROUP ---
    // Hydraulic Oil Temp (Mux1 Ch5)
    const hydTemp = getPhysicalValue(liveData.hyd_oil_temp, 'temp', 105);
    console.log("Hydraulic Oil Temp:", hydTemp);
    if (hydTemp <= sensor.hydraulic_oil_temperature.ranges.normal[0]) {
        status.errors.push({ code: "E08", msg: sensor.hydraulic_oil_temperature.actions.warning_low });
    }
    if (hydTemp >= sensor.hydraulic_oil_temperature.ranges.critical) {
        status.errors.push({ code: "E09", msg: sensor.hydraulic_oil_temperature.actions.critical_high });
    }

    // Boom Relief (Mux1 Ch11)
    const boomMpa = getPhysicalValue(liveData.boom_up_prs, 'prs', 50);
    if (boomMpa > 39.7) {
        status.errors.push({ code: "E11-H", msg: sensor.boom_relief_pressure.actions.critical_high });
    }

    // Swing Relief (Mux1 Ch13/14)
    const swingMpa = getPhysicalValue(liveData.swing_left_prs, 'prs', 50);
    if (swingMpa > 32.0) {
        status.errors.push({ code: "E13-H", msg: sensor.swing_relief_pressure.actions.critical_high });
    }

    // --- 3. TRAVEL GROUP ---
    // Travel Relief (Mux2 Ch3,4,5,6)
    const travelMpa = getPhysicalValue(liveData.travel_lr_prs, 'prs', 50);
    if (travelMpa > 40.2) {
        status.errors.push({ code: "E14-H", msg: sensor.travel_relief_pressure.actions.critical_high });
    }

    // --- 4. AMBIENT & ENVIRONMENT ---
    // Ambient Air Pressure (Mux2 Ch0)
    const ambKpa = getPhysicalValue(liveData.amb_air_prs, 'prs', 110);
    if (ambKpa < 90) {
        status.predictions.push(sensor.ambient_air_pressure.actions.warning);
    }

    // Sunshine Sensor (Mux2 Ch2) - 0-5V mapping
    const sunVal = (liveData.sunshine_sen / 28) * 5;
    if (sunVal > 4.5) status.predictions.push("High Solar Load detected by Sunshine sensor.");

    // --- 5. DIGITAL INPUTS (Direct Mapping) ---
    // Engine Oil Level
    if (liveData.eng_oil_lvl < 45) {
        status.errors.push({ code: "E17", msg: sensor.engine_oil_level.actions.critical_low });
    }
    if (liveData.eng_oil_lvl >= 65) {
        status.errors.push({ code: "E18", msg: sensor.engine_oil_level.actions.warning_high });
    }

    return status;
};