const Joi = require('joi');
const xss = require('xss-clean/lib/xss').clean;

// Custom sanitization wrapper
const validateSchema = (schema) => (req, res, next) => {
  // Sanitize req.body for XSS first
  if (req.body) {
    req.body = JSON.parse(xss(JSON.stringify(req.body)));
  }

  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  
  if (error) {
    const errorMessages = error.details.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    return res.status(400).json({ success: false, errors: errorMessages });
  }

  req.body = value;
  next();
};

const schemas = {
  register: Joi.object({
    name: Joi.string().trim().max(50).required().messages({
      'string.empty': 'Name is required',
      'string.max': 'Name cannot exceed 50 characters'
    }),
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.email': 'Valid email required'
    }),
    password: Joi.string().min(8)
      .pattern(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
      .required().messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain a letter, a number, and a special character'
      }),
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.email': 'Valid email required'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required'
    })
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.email': 'A valid email address is required'
    })
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.email': 'Valid email required'
    }),
    resetToken: Joi.string().required().messages({
      'string.empty': 'Reset token is required'
    }),
    newPassword: Joi.string().min(8)
      .pattern(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
      .required().messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain a letter, a number, and a special character'
      }),
  }),

  googleOAuth: Joi.object({
    idToken: Joi.string().required().messages({
      'string.empty': 'Google ID token is required'
    })
  }),

  facebookOAuth: Joi.object({
    accessToken: Joi.string().required().messages({
      'string.empty': 'Facebook access token is required'
    })
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().lowercase().trim().required().messages({
      'string.email': 'Valid email required'
    }),
    otp: Joi.string().length(6).required().messages({
      'string.length': 'OTP must be exactly 6 digits'
    })
  }),
};

module.exports = { validateSchema, schemas };
