
const color_config = {
    RED: "\x1b[38;2;255;85;85m",   
    GREEN: "\x1b[38;2;80;250;123m", 
    YELLOW: "\x1b[38;2;241;250;140m",
    RESET: "\x1b[0m",
};

function currentTime() {
    const date = new Date();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function err(message) {
    console.log(`${color_config.RED} ${message}${color_config.RESET}`);
}

function notify(message) {
    console.log(`${color_config.YELLOW} ${message}${color_config.RESET}`);
}

function success(message) {
    console.log(`${color_config.GREEN} ${message}${color_config.RESET}`);
}

function critical(message) {
    console.log(`${color_config.RED} ${message}${color_config.RESET}`);
    process.exit(1);
}

export default {
    err,
    notify,
    success,
    critical,
    currentTime
}