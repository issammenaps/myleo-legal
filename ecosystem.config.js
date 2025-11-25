module.exports = {
    apps: [
        {
            name: 'myleo-chatbot-unified',
            script: './service/server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/unified-error.log',
            out_file: './logs/unified-out.log',
            log_file: './logs/unified-combined.log',
            time: true,
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 10000
        }
    ]
};
