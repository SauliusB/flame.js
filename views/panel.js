//= require ./root_view
//= require ./label_view

// When multiple panels with modal panes are shown at the same time, we need this to get them to stack on
// top of each other. If they use a static z-index, all the panels would appear on top of all the modal panes.
Flame._zIndexCounter = 100;

// A pop-up panel, modal or non-modal. The panel is destroyed on closing by default. If you intend to reuse the same
// panel instance, set destroyOnClose: false.
Flame.Panel = Flame.RootView.extend({
    classNames: ['flame-panel'],
    childViews: ['titleView', 'contentView'],
    destroyOnClose: true,
    acceptsKeyResponder: true,
    isModal: true,
    allowClosingByClickingOutside: true,
    allowMoving: false,
    dimBackground: true,
    title: null,
    isShown: false,

    _keyResponderOnPopup: undefined,

    init: function() {
        ember_assert('Flame.Panel needs a contentView!', !!this.get('contentView'));
        this._super();
    },

    titleView: Flame.View.extend(Flame.Statechart, {
        layout: { left: 0, right: 0, height: 26, bottomPadding: 1 },
        classNames: ['flame-panel-title'],
        childViews: ['labelView'],
        isVisibleBinding: Ember.Binding.from('parentView.title').isNull().not(),
        initialState: 'idle',

        labelView: Flame.LabelView.extend({
            layout: { left: 4, right: 4, top: 2 },
            textAlign: Flame.ALIGN_CENTER,
            valueBinding: 'parentView.parentView.title'
        }),

        idle: Flame.State.extend({
            mouseDown: function(event) {
                var owner = this.get('owner');
                if (!owner.getPath('parentView.allowMoving')) {
                    return true;
                }
                owner._pageX = event.pageX;
                owner._pageY = event.pageY;
                var offset = owner.get('parentView').$().offset();
                owner._panelX = offset.left;
                owner._panelY = offset.top;
                this.gotoState('moving');
                return true;
            }
        }),

        moving: Flame.State.extend({
            mouseMove: function(event) {
                var owner = this.get('owner');
                var newX = owner._panelX + (event.pageX - owner._pageX);
                var newY = owner._panelY + (event.pageY - owner._pageY);
                var element = owner.get('parentView').$();
                newX = Math.max(5, Math.min(newX, Ember.$(window).width() - element.outerWidth() - 5));  // Constrain inside window
                newY = Math.max(5, Math.min(newY, Ember.$(window).height() - element.outerHeight() - 5));
                element.css({left: newX, top: newY, right: '', bottom: '', marginLeft: '', marginTop: ''});
                return true;
            },
            mouseUp: Flame.State.gotoHandler('idle')
        })
    }),

    // This is the pane that's used to obscure the background if isModal === true
    modalPane: function() {
        return Flame.RootView.create({
            layout: { left: 0, top: 0, right: 0, bottom: 0 },
            classNames: ['flame-modal-pane'],
            classNameBindings: ['parentPanel.dimBackground'],

            parentPanel: null,
            mouseDown: function() {
                if (this.getPath('parentPanel.allowClosingByClickingOutside')) {
                    this.get('parentPanel').close();
                }
                return true;
            }
        });
    }.property(),

    insertNewline: function(event) {
        var defaultButton = this.firstDescendantWithProperty('isDefault');
        if (defaultButton && defaultButton.simulateClick) {
            defaultButton.simulateClick();
        }
        return true;
    },

    _layoutRelativeTo: function(anchor, position) {
        position = position || Flame.POSITION_BELOW;
        var layout = this.get('layout');

        var anchorElement = anchor instanceof jQuery ? anchor : anchor.$();
        var offset = anchorElement.offset();

        if (position & Flame.POSITION_BELOW) {
            layout.top = offset.top + anchorElement.outerHeight();
            layout.left = offset.left;
            if (position & Flame.POSITION_MIDDLE) {
                layout.left = layout.left - (layout.width / 2) + (anchorElement.outerWidth() / 2);
            }
        } else if (position & Flame.POSITION_RIGHT) {
            layout.top = offset.top;
            layout.left = offset.left + anchorElement.outerWidth();
            if (position & Flame.POSITION_MIDDLE) {
                layout.top = layout.top - (layout.height / 2) + (anchorElement.outerHeight() / 2);
            }
        } else {
            ember_assert('Invalid position for panel', false);
        }

        // Make sure the panel is still within the viewport horizontally ...
        var _window = Ember.$(window);
        if (layout.left + layout.width > _window.width() - 10) {
            layout.left = _window.width() - layout.width - 10;
        }
        // ... and vertically
        if (layout.top + layout.height > _window.height() - 10) {
            layout.top = _window.height() - layout.height - 10;
        } else if (layout.top < 0) { layout.top = 10; }
        return layout;
    },

    popup: function(anchor, position) {
        if (!this.get('isShown')) {
            if (this.get('isModal')) {
                var modalPane = this.get('modalPane');
                modalPane.set('parentPanel', this);
                modalPane.get('layout').zIndex = Flame._zIndexCounter;
                modalPane.append();
                this.set('_modalPane', modalPane);
            }

            if (anchor) {
                this.set("layout", this._layoutRelativeTo(anchor, position));
            }
            this.get('layout').zIndex = Flame._zIndexCounter + 10;
            Flame._zIndexCounter += 100;

            this.append();
            this.set('isShown', true);
            if (this.get('acceptsKeyResponder')) this.becomeKeyResponder(false);
            this._focusDefaultInput();
        }
    },

    close: function() {
        if (this.isDestroyed) { return; }
        if (this.get('isShown')) {
            if (this.get('isModal')) {
                this.get('_modalPane').remove();
            }
            this.remove();
            this.set('isShown', false);
            if (this.get('acceptsKeyResponder')) this.resignKeyResponder();
            Flame._zIndexCounter -= 100;

            if (this.get('destroyOnClose')) this.destroy();
        }
    },

    _focusDefaultInput: function() {
        // Let Ember render the element before we focus it
        Ember.run.next(this, function() {
            var defaultFocus = this.firstDescendantWithProperty('isDefaultFocus');
            if (defaultFocus) { defaultFocus.becomeKeyResponder(); }
        });
    }
});
