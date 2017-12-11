const readline = require('readline');
const Thingy = require('thingy52');
const forEach = require('lodash/forEach');
const toInteger = require('lodash/toInteger');
const SCAN_WINDOW = 5000;
const SENSOR_INIT_TIMEOUT = 2000;
const TELEMETRY_INTERVAL = 1000;
let scanResults = [];
let sigint = false;

let currentTemperature = 0;
let currentPressure = 0;
let currentHumidity = 0;

function scan() {
    console.log(`Searching Thingy:52 (${SCAN_WINDOW}ms) ...`);
    scanResults = [];

    Thingy.discoverAll((thingy) => {
        scanResults.push(thingy);
    });

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (scanResults.length) {
                resolve(scanResults);
            } else {
                reject({
                    message: "Not found any Thingy:52"
                });
            }
        }, SCAN_WINDOW);
    })
}

function renderScanResults(things) {
    console.log("Scan results:");
    forEach(things, (item, index) => {
        console.log(`${index+1}) ${item.address}`);
    });
    return Promise.resolve(things);
}

function questionChooseThingy(things) {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter number of Thingy:52 from scan: ', (a) => {
            const answer = toInteger(a);
            const isValid = answer >= 1 && answer <= things.length;
            if (!isValid) {
                rl.close();
                reject({
                    message: "Invalid value. Interrupting."
                });
            } else {
                const thingy = things[answer-1];
                console.log(`You choose: ${thingy.address}`);
                resolve(thingy);
            }
        });
    });
}

function connectAndSetupEnvironment(thingy) {
    return new Promise((resolve, reject) => {
        thingy.connectAndSetUp((error) => {
            if (error) {
                reject({
                    message: 'Connection error: ' + error
                });
            }
            const intervalSetErrorCb = (error) => {
                if (error) {
                    reject({
                        message: 'Interval set error: ' + error
                    });
                }
            };
            const intervalStartErrorCb = (error) => {
                if (error) {
                    reject({
                        message: 'Sensor start error: ' + error
                    });
                }
            };

            thingy.temperature_interval_set(TELEMETRY_INTERVAL, intervalSetErrorCb);
            thingy.temperature_enable(intervalStartErrorCb);
            thingy.on('temperatureNotif', (metric) => { currentTemperature = metric });

            thingy.pressure_interval_set(TELEMETRY_INTERVAL, intervalSetErrorCb);
            thingy.pressure_enable(intervalStartErrorCb);
            thingy.on('pressureNotif', (metric) => { currentPressure = metric });

            thingy.humidity_interval_set(TELEMETRY_INTERVAL, intervalSetErrorCb);
            thingy.humidity_enable(intervalStartErrorCb);
            thingy.on('humidityNotif', (metric) => { currentHumidity = metric });

            setTimeout(() => {
                console.log('Connected!');
                resolve(thingy);
            }, SENSOR_INIT_TIMEOUT);
        });
    });
}

function connect(thingy) {
    thingy.on('disconnect', function() {
        if (!sigint) {
            console.log('Disconnected! Trying to reconnect');
            connectAndSetupEnvironment(this);
        }
    });
    return connectAndSetupEnvironment(thingy);
}

function getCurrentValues() {
    return {
        temperature: currentTemperature,
        humidity: currentHumidity,
        pressure: currentPressure
    };
}

module.exports = {
    scan,
    renderScanResults,
    questionChooseThingy,
    connect,
    getCurrentValues
};
