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

  profileUpdate: Joi.object({
    name: Joi.string().trim().max(50).messages({
      'string.max': 'Name cannot exceed 50 characters'
    }),
    phone: Joi.string().trim().max(15).allow('').messages({
      'string.max': 'Phone cannot exceed 15 characters'
    }),
    username: Joi.string().trim().max(30).pattern(/^[a-zA-Z0-9_]+$/).allow('', null).messages({
      'string.max': 'Username cannot exceed 30 characters',
      'string.pattern.base': 'Username can only contain letters, numbers, and underscores'
    }),
    alternateEmail: Joi.string().email().lowercase().trim().allow('', null).messages({
      'string.email': 'Valid email required'
    }),
    gender: Joi.string().valid('male', 'female', 'other', '').messages({
      'any.only': 'Gender must be male, female, other, or empty'
    }),
    preferences: Joi.object({
      emailNotifications: Joi.boolean(),
      smsNotifications: Joi.boolean(),
    }),
  }),

  address: Joi.object({
    fullName: Joi.string().trim().max(50).required().messages({
      'string.empty': 'Full name is required',
      'string.max': 'Full name cannot exceed 50 characters'
    }),
    phone: Joi.string().trim().required().pattern(/^(\+91[-\s]?)?[6-9]\d{9}$/).messages({
      'string.empty': 'Phone is required',
      'string.pattern.base': 'Please enter a valid Indian mobile number'
    }),
    addressLine1: Joi.string().trim().max(200).required().messages({
      'string.empty': 'Address line 1 is required',
      'string.max': 'Address line 1 cannot exceed 200 characters'
    }),
    addressLine2: Joi.string().trim().max(200).allow('').default(''),
    city: Joi.string().trim().max(50).required().messages({
      'string.empty': 'City is required',
      'string.max': 'City cannot exceed 50 characters'
    }),
    state: Joi.string().trim().max(50).required().messages({
      'string.empty': 'State is required',
      'string.max': 'State cannot exceed 50 characters'
    }),
    pincode: Joi.string().trim().required().pattern(/^\d{6}$/).messages({
      'string.empty': 'Pincode is required',
      'string.pattern.base': 'Pincode must be exactly 6 digits'
    }),
    country: Joi.string().trim().max(50).default('India'),
    isDefault: Joi.boolean().default(false),
  }),
};

module.exports = { validateSchema, schemas };
