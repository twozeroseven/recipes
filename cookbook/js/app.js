(function() {
"use strict";

	window.App = Ember.Application.create({
		LOG_VIEW_LOOKUPS: true
	});

	App.Router.map(function() {
	  this.resource('recipes', { path: '/'});
	  this.resource('recipe', { path: '/recipe/:recipe_id' });
	  this.resource('category', { path: '/category/:category_id'});
	  this.resource('recipenew', { path: '/recipe/new' })
	});

	/* helpers */
	Ember.Handlebars.helper('breaklines', function(text) {
		text = Handlebars.Utils.escapeExpression(text);
   	 	text = text.replace(/(\\r\\n|\\n|\\r)/gm, '\r\n');
    	return text;
	});

	Ember.Handlebars.helper('formatDate', function(value) {
	  var d = new Date(value);
	  return d.toDateString();
	});

	function getSimilarRecipes(ings){
		var flatCurrentRecipe = ings.map(function(e){
			return e.value;
		})

		function dynamicSort(property) {
		    var sortOrder = 1;
		    if(property[0] === "-") {
		        sortOrder = -1;
		        property = property.substr(1);
		    }
		    return function (a,b) {
		        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
		        return result * sortOrder;
		    }
		}

		var ingMatrix = [];
		App.RecipeData.forEach(function(r){
			if (r.ings){
				var sweet = r.ings.map(function(ings){
					return ings.value; 
				}).reduce(function(prev,next,index,array){
					var i = flatCurrentRecipe.indexOf(next);
					return (i>-1) ? prev + 1 : prev;		
				},0);
				if (sweet > 0)
				{
					ingMatrix.push({
						obj: r,
						count: sweet
					});
				}
			}
		});

		ingMatrix.sort(dynamicSort("-count"));
		//remove the top entry
		ingMatrix.shift();
		//return only 5 results
		return ingMatrix.slice(0,5).map(function(o){
			return o.obj;
		});
	}

	/* Ember Objects */
	App.RecipeData = [];

	App.Recipe = Ember.Object.extend({
		id: function()
		{
			return this.get("recipeId")
		}.property("recipeId"),
		ratingint: function(){
			var x = 0;
			if (this.get("rating") != null)
			{
				x = Array(parseInt(this.get("rating")));
			} 
			return x
		}.property(),
		ingnum: function(){
			return (this.get("ings")) ? parseInt(this.get("ings").length) : 0
		}.property('ings@each'),
		description: function(){
			var split = this.get("descr").split("\\r\\n");
			if (this.get("descr") == undefined)
			{
				return [""];
			}
			else if (split.length < 2)
			{
				return [split];
			}
			else
			{
				return split;
			}
		}.property(),
		yieldstr: function(){
			return this.get("yield")
		}.property(),
		similarRecipes: function(){
			return getSimilarRecipes(this.get("ings"));
		}.property("recipe"),
		thumbnail: function(){
			var q = encodeURIComponent(this.get("title").replace(/\(\)/g,"").slice(0,41)),
				imgStr = "",
				self = this;

			$.getJSON('https://ajax.googleapis.com/ajax/services/search/images?q=' + q + '&v=1.0&rsz=1&imgsz=large&callback=?', 
				function(data) {
				  	if (data.responseData && data.responseData.results.length > 0)
				  	{
					  	self.set("tempThumb",data.responseData.results[0].url);
					}
				}
			);
		}.property()
	});

	/* Category */
	App.CategoryRoute = Ember.Route.extend({
		model: function(params) {
			console.log(params);
			var flags = ["basic","slow","party","app","entree","try","pastry", "top"],
				r = null;
			if (flags.indexOf(params.category_id) > -1)
			{
				if (params.category_id == "top")
				{
					r = App.RecipeData.filterProperty("rating", "5");
				}
				else
				{
					var str = params.category_id + "Flg";
					r = App.RecipeData.filter(function(item, index, enumerable){
						return (item[str]) ? (item[str] || item[str] == 'Y') : null;
					});
				}
			}
			else
			{
				r = App.RecipeData.filterProperty('tags', params.category_id);
			}
			return r;
		}
	});	

	App.RecipenewRoute = Ember.Route.extend({
		model: function(){
			var recipe = App.Recipe.create({ "ings": [
				{ "value":"", "notes":"","amount":""},
				{ "value":"", "notes":"","amount":""},
				{ "value":"", "notes":"","amount":""}
			]});
			return recipe;
		}
	});

	App.RecipenewController = Ember.ObjectController.extend({
		actions: {
			submitRecipe: function(model){
				
				//remove empty ing
				model.ings.forEach(function(ing,i){
					if (ing.amount == "" && ing.notes == "" && ing.value == "")
					{
						model.ings.splice(i,1);
					}
				});

				var self = this,
				serialized = JSON.stringify(model),
				currentModel = this.get("model");
				
				jQuery.ajax({
					type: "POST",
					url: "/recipes/addRecipe",
					data: serialized,
					contentType:"application/json; charset=utf-8",
        			dataType: "json"
        		}).then(function(e){
					if (e.status == 200)
					{
						model.set("recipeId",e.resp);
						App.RecipeData.pushObject(model);
						//currentModel.deleteRecord();
					}
					else { console.log(e.status + " - " + e.resp); }
				});
			},
			addIng: function(){
				this.get("ings").pushObject({ "value":"", "notes":"","amount":""});
			}
		}
	});

	App.RecipesController = Ember.ObjectController.extend({
		filteredCategories: function(params) {
		    console.log(params);
		    var filter = 'mod1';
		    return this.get('model').filterProperty('tags', filter); 
	  	}.property('model.@each.tags'),
	  	totalRecipes: function(){
	  		return this.get("model").length;
	  	}.property('model.@each')
	});

	App.RecipesRoute = Ember.Route.extend({
		model: function(){
			return App.RecipeData;
		}
	});

	App.ApplicationRoute = Ember.Route.extend({
		model: function() {
			console.log("getting data on app route");
			return jQuery.getJSON("/recipes", function(json) {
				console.log("inside callback - data returned!");
				json.forEach(function(recipe){
					recipe.id = recipe.recipeId;
					App.RecipeData.pushObject(App.Recipe.create(recipe));
				});
			});
		},
		actions: {
		    loading: function(transition, originRoute) {
		      console.log("loading!")
		  	}
		}
	});

	App.ApplicationController = Ember.ObjectController.extend({
		actions: {
			gotoRecipe: function(datum){
			   console.log("navigating to " + datum.id);
			   this.transitionToRoute('recipe',datum.id);
			}
		},
		allTitles: function(){
			return this.get("model").map(function(r){
				return (r.title) ? {'id': r.recipeId, 'value': r.title}  : false;
			})
		}.property('model.@each')

	});

	App.RecipeRoute = Ember.Route.extend({
		needs:['application'],
		model: function(params)
		{
			console.log("recipe route");
			console.log(params);
			return App.RecipeData.findProperty('id', parseInt(params.recipe_id));
		},
		actions: {
		    loading: function(transition, originRoute) {
		      return true;
		  	}
		}
	});

	App.RecipeView = Ember.View.extend({
		didInsertElement: function(){
			console.log("recipe displayed");
		}
	});

	App.RecipeController = Ember.ObjectController.extend({
		actions: {
			deleteRecipe: function(){
				var selfController = this;
				var resp = window.confirm("Are you sure you want to delete this recipe?");
				if (resp) {
					//delete recipe
					var serialized = JSON.stringify({ id : this.get("id") });
					jQuery.ajax({
						type: "POST",
						url: "/recipes/deleteRecipe",
						data: serialized,
						contentType:"application/json; charset=utf-8",
	        			dataType: "json",
					}).then(function(e){
						if (e.status == 200)
						{
							var deletedId = e.resp;
							App.RecipeData.removeObject(App.RecipeData.findBy("id", deletedId));
							selfController.transitionToRoute("/")	
						}
						else { console.log(e.status + " - " + e.resp); }
					});
				}
			},
			submitNote: function(){
				var self = this;
				var model = {
					text: this.get("newnote"),
					id: this.get("id")
				};
				var serialized = JSON.stringify(model);
				jQuery.ajax({
					type: "POST",
					url: "/recipes/addNote",
					data: serialized,
					contentType:"application/json; charset=utf-8",
        			dataType: "json",
					success: function(e){
						if (e.status == 200)
						{
							var notes = self.get("notes") || [];
							notes.pushObject(e.resp);
						}
						else { console.log(e.status + " - " + e.resp); }
					}
				});
			},
			deleteNote: function(e){
				var self = this;
				var model = {
					date: e.date,
					text: e.text,
					id: this.get("id")
				};
				var serialized = JSON.stringify(model);
				jQuery.ajax({
					type: "POST",
					url: "/recipes/deleteNote",
					data: serialized,
					contentType:"application/json; charset=utf-8",
        			dataType: "json",
					success: function(e){
						if (e.status == 200)
						{
							var notes = self.get("notes") || [];
							notes.removeObject(notes.findBy("text", e.resp.text));
						}
						else { console.log(e.status + " - " + e.resp); }
					}
				});
			}
		}
	});

	/*
	App.RecipeSuggestionsRoute = Ember.Route.extend({
		model: function(params)
		{
			console.log(params);
			App.CurrentRecipe = App.RecipeData.findProperty('id', params.recipe_id);
			
			var flatCurrentRecipe = App.CurrentRecipe.ings.map(function(e){
				return e.value;
			})

			function dynamicSort(property) {
			    var sortOrder = 1;
			    if(property[0] === "-") {
			        sortOrder = -1;
			        property = property.substr(1);
			    }
			    return function (a,b) {
			        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
			        return result * sortOrder;
			    }
			}

			var ingMatrix = [];
			App.RecipeData.forEach(function(r){
				if (r.ings){
					var sweet = r.ings.map(function(ings){
						return ings.value; 
					}).reduce(function(prev,next,index,array){
						var i = flatCurrentRecipe.indexOf(next);
						return (i>-1) ? prev + 1 : prev;		
					},0);
					if (sweet > 0)
					{
						ingMatrix.push({
							obj: r,
							count: sweet
						});
					}
				}
			});

			ingMatrix.sort(dynamicSort("-count"));
			//remove the top entry
			ingMatrix.shift();

			return ingMatrix.slice(5);
		}
	});
	*/

	App.AutocompleteView = Ember.View.extend({
		didInsertElement: function(){
			var self = this,
				$txt = $('.searchBar input.ember-text-field');

			this.$('.searchBar input.ember-text-field').typeahead({
			   local: this.controller.parentController.get("allTitles"),
			   name: 'recipes'
			});

			$txt.bind('typeahead:selected', function(obj, datum, name) {  
			   self.get('controller').send('gotoRecipe', datum);
			   $(this).typeahead('setQuery', '');
			});
		}
	});

})();
