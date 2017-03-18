
import strength from 'strength';
import { exec } from 'child-process-promise';
import gemoji from 'gemoji';
import s from 'underscore.string';
import validator from 'validator';
import os from 'os';
import _ from 'lodash';
import path from 'path';

// load the defaults and environment specific configuration
import dotenvExtended from 'dotenv-extended';
import dotenvMustache from 'dotenv-mustache';
import dotenvParseVariables from 'dotenv-parse-variables';

let env = dotenvExtended.load({
  silent: false,
  errorOnMissing: true,
  errorOnExtra: true
});
env = dotenvMustache(env);
env = dotenvParseVariables(env);

import pkg from '../../package.json';
import environments from './environments';
import locales from './locales';
import i18n from './i18n';

const omitCommonFields = [ '_id', '__v' ];

let config = {

  // check daily for crocodilejs updates
  updateCheckInterval: 1000 * 60 * 60 * 24,

  // server
  protocols: {
    web: env.WEB_PROTOCOL,
    api: env.API_PROTOCOL
  },
  ports: {
    web: env.WEB_PORT,
    api: env.API_PORT
  },
  hosts: {
    web: env.WEB_HOST,
    api: env.API_HOST
  },
  env: env.NODE_ENV,
  urls: {
    web: env.WEB_URL,
    api: env.API_URL
  },
  ssl: {
    web: {},
    api: {}
  },

  // app
  webRequestTimeoutMs: env.WEB_REQUEST_TIMEOUT_MS,
  apiRequestTimeoutMs: env.API_REQUEST_TIMEOUT_MS,
  contactRequestMaxLength: env.CONTACT_REQUEST_MAX_LENGTH,
  cookiesKey: env.COOKIES_KEY,
  email: {
    from: env.EMAIL_DEFAULT_FROM,
    attachments: [],
    headers: {}
  },
  livereload: {
    port: env.LIVERELOAD_PORT
  },
  showStack: env.SHOW_STACK,
  ga: env.GOOGLE_ANALYTICS,
  sessionKeys: env.SESSION_KEYS,
  rateLimit: {
    duration: 60000,
    max: env.NODE_ENV === 'production' ? 100 : 1000,
    id: ctx => ctx.ip
  },
  koaManifestRev: {
    manifest: path.join(__dirname, '..', '..', 'build', 'rev-manifest.json'),
    // note in production we switch this to CloudFront
    prepend: '/'
  },
  appFavicon: path.join(__dirname, '..', 'assets', 'img', 'favicon.ico'),
  appName: env.APP_NAME,
  serveStatic: {
    maxage: env.MAX_AGE
  },

  // postmarkapp.com
  postmark: {
    service: 'postmark',
    auth: {
      user: env.POSTMARK_API_TOKEN,
      pass: env.POSTMARK_API_TOKEN
    }
  },

  // mongoose
  mongooseDebug: env.MONGOOSE_DEBUG,
  mongooseReconnectMs: env.MONGOOSE_RECONNECT_MS,
  omitCommonFields,
  omitUserFields: [
    ...omitCommonFields,
    'email',
    'api_token',
    'group',
    'attempts',
    'last',
    'hash',
    'salt',
    'google_profile_id',
    'google_access_token',
    'google_refresh_token'
  ],

  // localization
  localesDirectory: path.join(__dirname, '..', '..', 'src', 'locales'),

  // agenda
  agenda: {
    name: `${os.hostname()}_${process.pid}`,
    collection: env.AGENDA_COLLECTION_NAME,
    maxConcurrency: env.AGENDA_MAX_CONCURRENCY
  },

  aws: {
    key: env.AWS_IAM_KEY,
    accessKeyId: env.AWS_IAM_KEY,
    secret: env.AWS_IAM_SECRET,
    secretAccessKey: env.AWS_IAM_SECRET,
    distributionId: env.AWS_CF_DI,
    domainName: env.AWS_CF_DOMAIN,
    params: {
      Bucket: env.AWS_S3_BUCKET
    }
  },

  // getsentry.com
  sentry: env.SENTRY_DSN,
  raven: env.RAVEN_DSN,

  // mongodb
  mongodb: env.DATABASE_URL,
  mongodbOptions: {
    server: {
      reconnectTries: Number.MAX_VALUE
    }
  },

  // redis
  redis: env.REDIS_URL,

  // templating
  buildDir: path.join(__dirname, '..', '..', 'build'),
  viewsDir: path.join(__dirname, '..', '..', 'src', 'app', 'views'),
  nunjucks: {
    extname: 'njk',
    autoescape: true,
    // watch
    // <https://mozilla.github.io/nunjucks/api.html#configure>
    noCache: env.NODE_ENV !== 'production',
    filters: {
      json: str => JSON.stringify(str, null, 2),
      emoji: str => {
        return gemoji.name[str] ? gemoji.name[str].emoji : '';
      },
      curl: cmd => {
        return new Promise(async (resolve, reject) => {
          try {
            const response = await exec(cmd, {
              stdio: 'ignore',
              timeout: env.CURL_FILTER_TIMEOUT_MS
            });
            resolve(response.stdout ? response.stdout : response);
          } catch (err) {
            if (err) console.log(err && err.stack);
            resolve(err.stderr ? err.stderr : err.message);
          }
        });
      }
    },
    globals: {
      version: pkg.version,
      _: _,
      s: s,
      validator: validator
    }
  },

  // csrf
  csrf: {},

  // authentication
  auth: {
    local: env.AUTH_LOCAL_ENABLED,
    providers: {
      facebook: env.AUTH_FACEBOOK_ENABLED,
      twitter: env.AUTH_TWITTER_ENABLED,
      google: env.AUTH_GOOGLE_ENABLED,
      github: env.AUTH_GITHUB_ENABLED,
      linkedin: env.AUTH_LINKEDIN_ENABLED,
      instagram: env.AUTH_INSTAGRAM_ENABLED,
      stripe: env.AUTH_STRIPE_ENABLED
    },
    strategies: {
      local: {
        usernameField: 'email',
        passwordField: 'password',
        usernameLowerCase: true,
        limitAttempts: true,
        maxAttempts: env.NODE_ENV === 'development' ? Number.MAX_VALUE : 5,
        digestAlgorithm: 'sha256',
        encoding: 'hex',
        saltlen: 32,
        iterations: 25000,
        keylen: 512,
        passwordValidator: (password, cb) => {
          if (env.NODE_ENV === 'development')
            return cb();
          const howStrong = strength(password);
          cb(howStrong < 3 ? new Error('Password not strong enough') : null);
        }
      },
      facebook: {},
      twitter: {},
      google: {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.WEB_URL}/auth/google/ok`
      },
      github: {},
      linkedin: {},
      instagram: {},
      stripe: {}
    },
    catchError: async function(ctx, next) {
      try {
        await next();
      } catch (err) {
        if (err.message === 'Consent required')
          return ctx.redirect('/auth/google/consent');
        ctx.flash('error', err.message);
        ctx.redirect('/login');
      }
    },
    callbackOpts: {
      successReturnToOrRedirect: '/',
      failureRedirect: '/login',
      successFlash: true,
      failureFlash: true
    },
    google: {
      accessType: 'offline',
      approvalPrompt: 'force',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    }
  },

  // CrocodileJS license key check URL
  licenseKeyCheckURL: env.CROCODILEJS_LICENSE_KEY_CHECK_URL

};

// localization support
config.locales = locales;
config.i18n = i18n;

if (_.isObject(environments[env.NODE_ENV]))
  config = _.merge(config, environments[env.NODE_ENV]);

config.nunjucks.globals.config = config;

config.auth.hasThirdPartyProviders = _.some(config.auth.providers, bool => bool);

export default config;
