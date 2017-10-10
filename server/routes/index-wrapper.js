//  This file wraps index.js, which has the main routes for the backend API.
//    Note that it is asynchronous.
//  It takes care of setup, security issues for routing requests
//    (e.g. making sure that only properly validated users can make
//    requests), and generic error handling. It also handles routes for
//    login requests.
//  USE CAUTION IN ADDING ROUTES TO THIS FILE:
//    ROUTES IN THIS FILE MIGHT BE EVALUATED BEFORE CHECKING IF THE USER IS
//    VALID
//  Generic routes probably belong in index.js.

import express from 'express';
import bodyParser from 'body-parser';
import expressSession from 'express-session';
import connectMongo from 'connect-mongo';
import mongoose from 'mongoose';

//  Some modules we may later need:
// import cookieParser from 'cookie-parser';

import { respondError } from '../_common/express-helpers';
import getConfigPromise from '../config';
import getDbConnection from '../models/db';
import login from '../controllers/login';
import indexMain from './index';

let User;

//  if the requestor has logged in as a valid user, set res.locals.user.
//  otherwise, respond that the user has insufficient credentials
async function validateUser(req, res, next) {
  if (!User) {
    User = mongoose.model('User');
  }

  if (req.session.userId) {
    res.locals.user = User.findOne({ _id: req.session.userId });
    if (!res.locals.user) req.session.userId = null;
  }

  if (!res.locals.user) {
    respondError(res, {
      reason: 'InvalidCredentials',
      message: 'Request does not have appropriate credentials.',
    }, 403);
    return;
  }

  next();
}

export default async function getRouter() {
  const config = await getConfigPromise();
  await getDbConnection();

  const router = express.Router();

  // app.use(cookieParser());

  // set up session store
  const MongoStore = connectMongo(expressSession);
  router.use(expressSession({
    secret: config.get('cookiesecret'),
    //  some options should be set when on GAE
    secure: config.get('is_gae'),
    cookie: { sameSite: true },
    saveUninitialized: false,
    // resave and touchAfter go together. resave specifies if the session
    // info is always resaved, even if unchanged. touchAfter (as best I can
    // tell) means how often to resave the session info even if nothing has
    // changed (and is given in seconds)
    resave: false,
    //  use default connection
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
      touchAfter: 24 * 3600,
    }),
  }));

  //  error if input is not get or JSON
  router.use((req, res, next) => {
    if (
      !(['GET', 'DELETE'].includes(req.method) || req.is('application/json'))
    ) {
      respondError(res, {
        message: 'Requests must be either GET or use JSON',
      }, 415);
      return;
    }
    next();
  });

  router.use(bodyParser.json());

  // login routes
  router.get('/login', login.loginGet);
  router.post('/login', login.loginPost);
  router.delete('/login', login.loginDelete);

  //  SECURITY STUFF
  //  check if user is logged in. if so, load the user document. if not,
  //  reject the request
  router.use(validateUser);

  //  Pass request to main router
  router.use(indexMain);

  // catch 404 and forward to error handler
  router.use((req, res, next) => {
    respondError(res, 'Not Found', 404);
  });

  // generic error handler
  router.use((err, req, res, next) => {
    //  only send errors in development
    console.error(`${new Date()} ERROR ${err.message}`);

    let error;
    //  send full errors only in development
    if (req.app.locals.isProduction) {
      error = { reason: 'ServerError', message: 'The server had an error.' };
    } else {
      error = {};
      for (const prop of Object.getOwnPropertyNames(err)) {
        const fromVal = err[prop];
        let toVal;
        if (fromVal instanceof Function) {
          toVal = fromVal.toString();
        } else {
          toVal = JSON.stringify(fromVal);
        }
        error[prop] = toVal;
      }
    }

    respondError(res, error, 500);
  });

  return router;
}
