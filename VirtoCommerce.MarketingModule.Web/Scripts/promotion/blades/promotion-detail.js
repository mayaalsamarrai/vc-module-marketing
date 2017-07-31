﻿angular.module('virtoCommerce.marketingModule')
.controller('virtoCommerce.marketingModule.promotionDetailController', ['$scope', 'platformWebApp.bladeNavigationService', 'virtoCommerce.marketingModule.promotions', 'virtoCommerce.catalogModule.catalogs', 'virtoCommerce.storeModule.stores', 'platformWebApp.settings', 'virtoCommerce.coreModule.common.dynamicExpressionService', function ($scope, bladeNavigationService, marketing_res_promotions, catalogs, stores, settings, dynamicExpressionService) {
    var blade = $scope.blade;
    blade.updatePermission = 'marketing:update';

    blade.refresh = function (parentRefresh) {
        if (blade.isNew) {
            if (blade.isCloning) {
                blade.data.id = null;
                blade.data.name = null;
                initializeBlade(blade.data);
            } else {
                marketing_res_promotions.getNew(initializeBlade);
            }
        } else {
            marketing_res_promotions.get({ id: blade.currentEntityId }, function (data) {
                initializeBlade(data);
                if (parentRefresh) {
                    blade.parentBlade.refresh();
                }
            });
        }
    };

    function initializeBlade(data) {
        if (!blade.isNew) {
            blade.title = data.name;
        }

        // transform simple string to complex object. Simple string isn't editable.
        data.coupons = _.map(data.coupons, function (x) { return { text: x } });

        if (data.dynamicExpression) {
            _.each(data.dynamicExpression.children, extendElementBlock);
        }

        blade.currentEntity = angular.copy(data);
        blade.origEntity = data;
        blade.isLoading = false;
    }

    function isDirty() {
        return !angular.equals(blade.currentEntity, blade.origEntity) && blade.hasUpdatePermission();
    }

    $scope.cancelChanges = function () {
        //angular.copy(blade.origEntity, blade.currentEntity);
        $scope.bladeClose();
    };

    $scope.saveChanges = function () {
        bladeNavigationService.setError(null, blade);
        blade.isLoading = true;

        blade.currentEntity.coupons = _.pluck(blade.currentEntity.coupons, 'text');

        //Here we need to set hours untill midnight for endDate to let expiration date include last promotion date
        //Promotion endDate now depends on time zone that set in user profile
        blade.currentEntity.endDate = moment(blade.currentEntity.endDate).set({ hours: 23, minutes: 59, seconds: 59 }).toDate();

        if (blade.currentEntity.dynamicExpression) {
            _.each(blade.currentEntity.dynamicExpression.children, stripOffUiInformation);
        }

        if (blade.isNew) {
            marketing_res_promotions.save({}, blade.currentEntity, function (data) {
                blade.isNew = undefined;
                blade.currentEntityId = data.id;
                initializeToolbar();
                blade.refresh(true);
            });
        } else {
            marketing_res_promotions.update({}, blade.currentEntity, function (data) {
                blade.refresh(true);
            });
        }
    };

    $scope.setForm = function (form) { $scope.formScope = form; };

    $scope.isValid = function () {
        return isDirty()
            && $scope.formScope
            && $scope.formScope.$valid
            && (!blade.currentEntity.dynamicExpression
             || (blade.currentEntity.dynamicExpression.children[0].children.length > 0
              && blade.currentEntity.dynamicExpression.children[3].children.length > 0));
    };

    blade.onClose = function (closeCallback) {
        bladeNavigationService.showConfirmationIfNeeded(isDirty() && !blade.isNew, $scope.isValid(), blade, $scope.saveChanges, closeCallback, "marketing.dialogs.promotion-save.title", "marketing.dialogs.promotion-save.message");
    };

    blade.headIcon = 'fa-area-chart';

    function initializeToolbar() {
        if (!blade.isNew) {
            blade.toolbarCommands = [
                {
                    name: "platform.commands.save",
                    icon: 'fa fa-save',
                    executeMethod: $scope.saveChanges,
                    canExecuteMethod: $scope.isValid,
                    permission: blade.updatePermission
                },
                {
                    name: "platform.commands.reset",
                    icon: 'fa fa-undo',
                    executeMethod: function () {
                        angular.copy(blade.origEntity, blade.currentEntity);
                    },
                    canExecuteMethod: isDirty,
                    permission: blade.updatePermission
                },
                {
                    name: "platform.commands.clone", icon: 'fa fa-files-o',
                    executeMethod: function () {
                        var newBlade = {
                            id: 'promotionClone',
                            title: 'marketing.blades.promotion-detail.title-new',
                            isNew: true,
                            isCloning: true,
                            data: blade.currentEntity,
                            controller: 'virtoCommerce.marketingModule.promotionDetailController',
                            template: 'Modules/$(VirtoCommerce.Marketing)/Scripts/promotion/blades/promotion-detail.tpl.html'
                        };
                        bladeNavigationService.showBlade(newBlade, blade.parentBlade);
                    },
                    canExecuteMethod: function () { return !isDirty(); },
                    permission: 'marketing:create'
                }
            ];
        }
    }

    // datepicker
    $scope.datepickers = {
        str: false,
        end: false
    };

    $scope.open = function ($event, which) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.datepickers[which] = true;
    };

    // Dynamic ExpressionBlock
    function extendElementBlock(expressionBlock) {
        var retVal = dynamicExpressionService.expressions[expressionBlock.id];
        if (!retVal) {
            retVal = { displayName: 'unknown element: ' + expressionBlock.id };
        }

        _.extend(expressionBlock, retVal);

        if (!expressionBlock.children) {
            expressionBlock.children = [];
        }
        _.each(expressionBlock.excludingCategoryIds, function (id) {
            expressionBlock.children.push({ id: 'ExcludingCategoryCondition', categoryId: id });
        });
        _.each(expressionBlock.excludingProductIds, function (id) {
            expressionBlock.children.push({ id: 'ExcludingProductCondition', productId: id });
        });

        _.each(expressionBlock.children, extendElementBlock);
        _.each(expressionBlock.availableChildren, extendElementBlock);
        return expressionBlock;
    }

    function stripOffUiInformation(expressionElement) {
        expressionElement.availableChildren = undefined;
        expressionElement.displayName = undefined;
        expressionElement.getValidationError = undefined;
        expressionElement.newChildLabel = undefined;
        expressionElement.templateURL = undefined;

        var selectedCategories = _.where(expressionElement.children, { id: 'ExcludingCategoryCondition' });
        expressionElement.excludingCategoryIds = _.pluck(selectedCategories, 'categoryId');
        expressionElement.children = _.difference(expressionElement.children, selectedCategories);

        var selectedProducts = _.where(expressionElement.children, { id: 'ExcludingProductCondition' });
        expressionElement.excludingProductIds = _.pluck(selectedProducts, 'productId');
        expressionElement.children = _.difference(expressionElement.children, selectedProducts);

        _.each(expressionElement.children, stripOffUiInformation);
    }

    
    //$scope.$watch('blade.currentEntity.endDate',
    //    function (newValue, oldValue, scope) {
    //        if (newValue != undefined && (newValue instanceof Date)) {
    //            debugger;
    //            //var date = angular.copy(blade.currentEntity.endDate)
    //            //date = moment(date).add({ hours: 23, minutes: 59, seconds: 59 }).toDate();
    //            //newValue = moment(newValue).add({ hours: 23, minutes: 57, seconds: 59 }).toDate();
    //            newValue.setHours(23, 59, 59);

    //        }
    //    }
    //);

    initializeToolbar();
    blade.refresh(false);
    $scope.stores = stores.query();
}]);