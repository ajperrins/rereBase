(function (global) {

  if (!moment) {
    throw new Error('Moment.js is required');
  }

  function ModelBase() {
    var privates = {};
    this.innerPrivate = function (name, value) {
      if (!value) {
        return privates[name];
      } else {
        privates[name] = value;
        return value;
      }
    };
  }

  /**
   * Stores something as a private field
   */
  ModelBase.prototype.private = function (name, value) {
    if (!this.innerPrivate) {
      throw Error('Missing innerPrivate function - did your subclass invoke ModelBase.call(this)?');
    }
    return this.innerPrivate(name, value);
  };


  // Anything we've extended (array of constructor functions)
  var models = [];

  /**
   * Returns the type (ctor function) if the 'this' context is a model
   */
  function getModel() {
    var self = this;
    return _.find(models, function (item) {
      return self instanceof item;
    });
  };


  var lastConsideredType, serializedObjects = [];

  /** 
   * Used in JSON.stringify - includes type name in json string representation. This _also_
   * avoids a type error when attempting to serialize an object graph that has circular
   * references
   */
  function replacer(key, value) {

    var type = getModel.call(value);
    if (type) {
      lastConsideredType = type;
      value.__t = type.name;
    }

    // The 'exclude' parameter, when defined as a 'static' property on the last considered 

    // constructor function, lets derived instances exclude properties from serialization
    var excludedType = lastConsideredType && lastConsideredType.exclude && lastConsideredType.exclude.indexOf(key) >= 0;

    // This prevents attemptign to serialize circular references
    ////var isObjectAlreadySerialized = serializedObjects.indexOf(value) !== -1;

    if (excludedType /*|| isObjectAlreadySerialized*/) {
      return undefined;
    } else {

      if (typeof value === 'object' && value != null) {
        serializedObjects.push(value);
      }

      return value;
    }
  };

  /**
   * Used in JSON.parse - extracts type names from json string and constructs
   * instances of those types when parsing
   */
  function reviver(key, value) {
    if (value && value.__t) {
      var ctor = _.find(models, function (model) {
        return model.name === value.__t;
      });
      var modelInstance = new ctor();

      _.extend(modelInstance, value);
      delete modelInstance.__t;
      value = modelInstance;
    }
    return value;
  }

  // Replace native JSON.stringify and JSON.parse with our implementation 
  // that keeps track of the constructor function for marshalling across the 
  // content/background. Our implementation eventually invokes the native JSON 
  // functions
  var _originalStringify = JSON.stringify;
  var _originalParse = JSON.parse;

  JSON.parse = function (str) {
    return _originalParse(str, reviver);
  };

  JSON.stringify = function (obj, otherReplacer, indentLevel) {
    serializedObjects.length = 0;
    if (otherReplacer) {
      return _originalStringify(obj, otherReplacer, indentLevel);
    } else {
      return _originalStringify(obj, replacer, indentLevel);
    }
  };

  /**
   * Set up prototype chain for given model to inherit from ModelBase
   */
  function extend(ctorFn) {
    function heir() { this.constructor = ctorFn; }
    heir.prototype = ModelBase.prototype;
    ctorFn.prototype = new heir();
  };

  /**
   * Extends provided constructor function from ModelBase,
   * and adds the new model to the the cmecf.models namespace
   */
  ModelBase.ExtendAndExport = function (ctorFn) {
    extend(ctorFn);

    // Puts the constructor function for this model in the models namespace
    global.cmecf.models[ctorFn.name] = ctorFn;
    models.push(ctorFn);
  };


  global.cmecf = global.cmecf || {};
  global.cmecf.models = global.cmecf.models || {};
  global.cmecf.models.ModelBase = ModelBase;


}(this));