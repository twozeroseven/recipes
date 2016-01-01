(function(root, undefined) {
  "use strict";
  Ember.TypeAheadComponent = Ember.Component.extend({
  tagName: 'input',
  attributeBindings: ['placeholder'],
  didInsertElement: function() {
    var _this = this;
    this.$().typeahead({
      name: this.get("name") || "typeahead",
      limit: this.get("limit") || 5,
      minLength: this.get('minLength') || 3,
      remote: this.get('remote') || null,
      template: this.get('customTemplate') || null,
      engine: {
        compile: function(template) {
          var compiled;
          compiled = Handlebars.compile(template);
          return {
            render: function(context) {
              return compiled(context);
            }
          };
        }
      }
    }).on("typeahead:selected typeahead:autocompleted", function(e, datum) {
      return _this.sendAction('action', datum);
    });
  }
});

}(this));