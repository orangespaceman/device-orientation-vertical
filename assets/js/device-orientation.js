(function() {

  // assume device doesn't report orientation unless proven otherwise
  // this allows us to update styles and behaviour only if supported
  var hasDeviceOrientationInited = false;

  // els: elements to scroll
  // for vertical scroll, some devices support `document.documentElement`
  // while others use `document.body` so to be safe we support both
  var scrollVerticalEl;
  var scrollVerticalElAlt;

  // initial values for beta/gamma, to base later calculations on
  var initialBeta = 0;

  // el: the wrapper element surrounds all page content
  var wrapperEl;
  var wrapperHeight = 0;

  // height of the screen
  var screenHeight = 0;

  // device orientation - default to portrait
  var isLandscape = false;
  var isRotatedClockwise = false;

  // int: store previous top value
  var lastTop;

  // debounced function for listening to resize events
  var resizeDebounceFunction = debounce(handleOrientationChange, 10);

  // debug els
  var debugAlphaEl;
  var debugBetaEl;
  var debugGammaEl;
  var debugBetaModifiedEl;
  var debugTopEl;

  // method called on page load to init all behaviour
  function load() {
    initElements();
    calculateCanvasDimensions();
    calculateDeviceOrientation();
    initScroll();
    initDebug();
  }

  // find all DOM elements
  function initElements() {
    scrollVerticalEl = document.documentElement;
    scrollVerticalElAlt = document.body;
    wrapperEl = document.querySelector('.Wrapper');
  }

  // gather canvas dimensions, to be used later in calculations
  function calculateCanvasDimensions() {
    wrapperHeight = wrapperEl.offsetHeight;
    wrapperWidth = wrapperEl.offsetWidth;
    screenHeight = document.documentElement.clientHeight;
  }

  // calculate whether the device is landscape or portrait
  function calculateDeviceOrientation(e) {
    isLandscape =
      document.documentElement.clientHeight < document.documentElement.clientWidth;
    isRotatedClockwise = window.orientation === -90;
  }

  // set initial scroll position
  function initScroll() {
    var top = wrapperHeight;
    updateScrollPosition(top);
  }

  // update scroll position
  function updateScrollPosition(top) {
    scrollVerticalEl.scrollTop = top;
    scrollVerticalElAlt.scrollTop = top;
  }

  // further initialisation logic from first device orientation event
  //
  // browsers report that they support device orientation
  // even when they don't contain a giroscope,
  // so for the first device orientation event,
  // set up site to support them
  function initDeviceOrientation() {
    var body = document.querySelector('body');
    body.classList.add('has-deviceOrientation');
    hasDeviceOrientationInited = true;

    // with the addition of a new class on the body element,
    // styles may now be different for devices that support device orientation,
    // so re-evaluate dimensions
    calculateCanvasDimensions();

    window.addEventListener('resize', resizeDebounceFunction);

    // Disable scrolling by touch
    wrapperEl.ontouchmove = function (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // recalculate values based on major device rotation
  // (e.g. landscape to portrait or vice versa)
  function handleOrientationChange() {
    // allow time for the screen layout to readjust first
    setTimeout(function() {
      calculateDeviceOrientation();
      calculateCanvasDimensions();

      // the initial values will need to be reassessed
      initialBeta = null;
    }, 500);
  }

  // update scroll position based on orientation change event
  function handleOrientationEvent(event) {
    if (!hasDeviceOrientationInited) {
      initDeviceOrientation();
    }

    // store initial values for later use
    if (!initialBeta) {
      initialBeta = calculateBeta(event);
    }

    // calculate orientation
    // need to switch beta/gamma if device is in landscape mode
    var beta = calculateBeta(event);

    // calculate scroll position from orientation
    var top = calculateVerticalScroll(beta, event);

    // update scroll
    updateScrollPosition(top);

    // store top value
    lastTop = top;

    debug(event, beta, top);
  }

  // calculate beta based on device orientation
  // and fix range values accordingly
  function calculateBeta(event) {
    if (isLandscape) {
      if (isRotatedClockwise) {
        return normaliseGammaClockwiseRotation(event.gamma);
      } else {
        return normaliseGammaAntiClockwiseRotation(event.gamma);
      }
    } else {
      return normaliseBeta(event.beta);
    }
  }

  // convert beta from [-180,180] to [0,360]
  // and make it increase consistently
  // rather than jump at the half-way point
  //
  // raw beta values start in the range:
  // 0    (face up)                    [--> 1 ]
  // 90   (horizontal)                 [--> 90 ]
  // 179  (almost face down)           [--> 179 ]
  // -179 (almost face down inverted)  [--> 181 new value]
  // -90  (horizontal inverted)        [--> 270 new value]
  // -1   (almost face up inverted)    [--> 359 new value]
  function normaliseBeta(beta) {
    if (beta < 0) { beta = 360 + beta; }
    if (beta > 270) { beta = 0; }
    return beta;
  }

  // convert gamma from [-90,90] to [0,180]
  // and make it increase consistently
  // rather than jump at the half-way point
  //
  // raw gamma values start in the range:
  // below the horizon, -90 (close to horizon) down to 0 (face up)
  // above the horizon, 90 (close to horizon) down to 0 (face down)
  //
  // -1   (face up)            [--> 179 new value]
  // -89  (just below horizon) [--> 91 new value]
  // 89   (just above horizon) [--> 89 ]
  // 1    (almost face down)   [--> 1 ]
  function normaliseGammaClockwiseRotation(gamma) {
    if (gamma < 0) { gamma = 180 - Math.abs(gamma); }
    return gamma;
  }

  // convert gamma from [-90,90] to [0,180]
  // and make it increase consistently
  // rather than jump at the half-way point
  //
  // raw gamma values start in the range:
  // below the horizon, 90 (close to horizon) down to 0 (face up)
  // above the horizon, -90 (close to horizon) down to 0 (face down)
  //
  // 1   (face up)              [--> 179 new value]
  // 89  (just below horizon)   [--> 91 new value]
  // -89   (just above horizon) [--> 89 new value]
  // -1    (almost face down)   [--> 1 new value]
  function normaliseGammaAntiClockwiseRotation(gamma) {
    if (gamma > 0) { gamma = 180 - gamma; }
    if (gamma < 0) { gamma = Math.abs(gamma); }
    return gamma;
  }

  // calculate new vertical scroll position
  // convert beta value to a value within page height range
  function calculateVerticalScroll(beta, event) {
    var currentBeta = beta;
    var maxBeta;

    // starting angle below horizon, max angle is directly above
    if (initialBeta <= 90) {
        maxBeta = 140;

    // starting angle above horizon, max angle reduced
    } else if (initialBeta <= 180) {
      if (!isLandscape) {
        maxBeta = initialBeta + 90;

      // cap landscape max at 180 as gamma values don't go above this
      // and it avoids complex maths...
      } else {
        maxBeta = 180;
      }

    // starting angle above head, max angle reduced and capped
    } else if (initialBeta > 180) {
      maxBeta = 250;
    }

    // lock to top when moving beyond max angle
    if (currentBeta > maxBeta) {
      if (!isLandscape) {
        currentBeta = maxBeta;
      } else {
        if (
          (isRotatedClockwise && event.gamma > 0) ||
          (!isRotatedClockwise && event.gamma < 0)
        ) {
          currentBeta = initialBeta;
        } else {
          currentBeta = maxBeta;
        }
      }
    }

    // lock to bottom when moving below initial angle
    if (currentBeta < initialBeta) {
      if (!isLandscape) {
        currentBeta = initialBeta;
      } else {

        // phone is currently above horizon
        if (Math.abs(event.beta) > 90) {

          // if the phone started above the horizon
          if (initialBeta > 90) {

            // lock to the top if if has gone beyond 180 degrees
            if (
              (isRotatedClockwise && event.gamma > 0) ||
              (!isRotatedClockwise && event.gamma < 0)
            ) {
              currentBeta = maxBeta;

            // lock to the bottom if it is just below the initial value
            } else {
              currentBeta = initialBeta;
            }

          // the phone started below the horizon, lock to bottom
          } else {
            currentBeta = maxBeta;
          }

        // phone is currently below horizon, lock to bottom
        } else {
          currentBeta = initialBeta;
        }
      }
    }

    // generate a value for the page scroll:
    // map the current beta from somewhere between its initial and max value
    // to somewhere between the top and bottom of the page
    var top = mapRange(currentBeta, initialBeta, maxBeta, wrapperHeight - screenHeight, 0);

    // if the top value has changed from last time
    if (lastTop && top !== lastTop) {

      // if the top value has increased or decreased by more than this value,
      // smooth the transition to reduce the visible jump
      // the higher the number, the less likely that any adjustment is needed
      var movementLimit = 5;

      // adjustment value to apply to smooth the transition
      // the closer to 0, the quicker the transition
      // the closer to 1, the slower the transition
      var scrollAdjustment = 0.9;

      // if we are scrolling down the page at too high a rate, adjust
      if (!isLandscape && top > lastTop && top - movementLimit > lastTop) {
        top = top - ((top - lastTop) * scrollAdjustment);

      // if we are scrolling up the page at too high a rate, adjust
      } else if (!isLandscape && top < lastTop && top + movementLimit < lastTop) {
        top = top + ((lastTop - top) * scrollAdjustment);
      }
    }

    return Math.round(top);
  }

  function initDebug() {
    debugAlphaEl = document.querySelector('.Debug-value--alpha');
    debugBetaEl = document.querySelector('.Debug-value--beta');
    debugGammaEl = document.querySelector('.Debug-value--gamma');
    debugBetaModifiedEl = document.querySelector('.Debug-value--betaModified');
    debugTopEl = document.querySelector('.Debug-value--top');
  }

  function debug(event, beta, top) {
    debugAlphaEl.textContent = Math.round(event.alpha);
    debugBetaEl.textContent = Math.round(event.beta);
    debugGammaEl.textContent = Math.round(event.gamma);
    debugBetaModifiedEl.textContent = Math.round(beta);
    debugTopEl.textContent = top;
  }

  // map a value from, one [min-max] range to another [min-max] range
  function mapRange(value, fromMin, fromMax, toMin, toMax) {
    return (value - fromMin) * (toMax - toMin) / (fromMax - fromMin) + toMin;
  }

  // https://davidwalsh.name/javascript-debounce-function
  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  // init listeners
  document.addEventListener('DOMContentLoaded', load);
  window.addEventListener('orientationchange', handleOrientationChange);
  window.addEventListener('deviceorientation', handleOrientationEvent);

})();
