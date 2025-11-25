module.exports = {
    apps: [
        {
            name: 'myleo-chatbot-service',
            script: './service/server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/service-error.log',
            out_file: './logs/service-out.log',
            log_file: './logs/service-combined.log',
            time: true
        },
        {
            name: 'faq-sync-scheduler',
            script: './scripts/scheduler.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/scheduler-error.log',
            out_file: './logs/scheduler-out.log',
            log_file: './logs/scheduler-combined.log',
            time: true
        }
    ]
};
