import Joi from 'joi';

export const WORKERS_CONFIG_VALIDATOR = Joi.object({
  websocket: Joi.object({
    auth_token: Joi.string().min(1).required(),
    config_check_interval_ms: Joi.number().integer().min(100).required(),
  }).required(),
});

