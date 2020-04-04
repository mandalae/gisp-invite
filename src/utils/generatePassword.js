const generatePasswordHash = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
}

const generatePassword = () => {
    return Math.random().toString(36).slice(-10);
}

module.exports = () => {
    const password = generatePassword();
    return {
        hash: generatePasswordHash(password),
        password: password
    };
}
