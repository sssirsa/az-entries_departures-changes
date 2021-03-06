const mongodb = require('mongodb');
const axios = require('axios');
//db connections
let management_client = null;
let entries_departures_client = null;
const connection_Management = process.env["connection_Management"];
const connection_EntriesDepartures = process.env["connection_EntriesDepartures"];
const MANAGEMENT_DB_NAME = process.env['MANAGEMENT_DB_NAME'];
const ENTRIES_DEPARTURES_DB_NAME = process.env['ENTRIES_DEPARTURES_DB_NAME'];

//URLS
const entries_departures = process.env["ENTRIES_DEPARTURES"];

module.exports = function (context, req) {
    switch (req.method) {
        case "GET":
            GET_changes();
            break;
        case "POST":
            POST_change();//Create change
            break;
        case "PUT":
            PUT_change();//Confirm change
            break;
        default:
            notAllowed();
            break;
    }

    function notAllowed() {
        context.res = {
            status: 405,
            body: "Method not allowed",
            headers: {
                'Content-Type': 'application/json'
            }
        };
        context.done();
    }

    async function GET_changes() {
        var requestedID;
        //var requestedKind;
        var query;
        var fecha_hora_entrada;
        var fecha_hora_salida;
        //Adding filters
        if (req.query) {
            requestedID = req.query['id'];
            if (req.query['economico']) {
                if (!query) {
                    query = {};
                }
                query['cabinets.economico'] = req.query['economico'];
            }
            if (req.query['fecha_inicio_entrada'] || req.query['fecha_fin_entrada']) {
                if (!query) {
                    query = {};
                }
                if (req.query['fecha_inicio_entrada']) {
                    if (!fecha_hora_entrada) {
                        fecha_hora_entrada = {};
                    }
                    fecha_hora_entrada['$gte'] = new Date(new Date(req.query['fecha_inicio_entrada']).setHours(00, 00, 00));
                }
                if (req.query['fecha_fin_entrada']) {
                    if (!fecha_hora_entrada) {
                        fecha_hora_entrada = {};
                    }
                    fecha_hora_entrada['$lte'] = new Date(new Date(req.query['fecha_fin_entrada']).setHours(23, 59, 59));
                }
                query['fecha_hora_entrada'] = fecha_hora_entrada;
            }
            if (req.query['fecha_inicio_salida'] || req.query['fecha_fin_salida']) {
                if (!query) {
                    query = {};
                }
                if (req.query['fecha_inicio_salida']) {
                    if (!fecha_hora_salida) {
                        fecha_hora_salida = {};
                    }
                    fecha_hora_salida['$gte'] = new Date(new Date(req.query['fecha_inicio_salida']).setHours(00, 00, 00));
                }
                if (req.query['fecha_fin_salida']) {
                    if (!fecha_hora_salida) {
                        fecha_hora_salida = {};
                    }
                    fecha_hora_salida['$lte'] = new Date(new Date(req.query['fecha_fin_salida']).setHours(23, 59, 59));
                }
                query['fecha_hora_salida'] = fecha_hora_salida;
            }
            if (req.query['sucursal_destino']) {
                if (!query) {
                    query = {};
                }
                query['sucursal_destino._id'] = mongodb.ObjectId(req.query['sucursal_destino']);
            }
            if (req.query['udn_destino']) {
                if (!query) {
                    query = {};
                }
                query['udn_destino._id'] = mongodb.ObjectId(req.query['udn_destino']);
            }
            if (req.query['sucursal_origen']) {
                if (!query) {
                    query = {};
                }
                query['sucursal_origen._id'] = mongodb.ObjectId(req.query['sucursal_origen']);
            }
            if (req.query['udn_origen']) {
                if (!query) {
                    query = {};
                }
                query['udn_origen._id'] = mongodb.ObjectId(req.query['udn_origen']);
            }
            if (req.query['confirmado']) {
                if (!query) {
                    query = {};
                }
                if (req.query['confirmado'] === 'true') {
                    query['confirmado'] = true;
                }
                if (req.query['confirmado'] === 'false') {
                    query['confirmado'] = false;
                }
            }
        }
        if (requestedID) {
            //Get specific change
            try {
                change = await getChange(requestedID);
                context.res = {
                    status: 200,
                    body: change,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();

            }
            catch (error) {
                if (error.status) {
                    context.res = error;
                }
                else {
                    context.res = {
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                }
                context.done();
            }
        }

        else {
            //Get entries list
            try {
                let entries = await getChanges(query);
                context.res = {
                    body: entries,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                context.done();
            }
            catch (error) {
                if (error.status) {
                    context.res = error;
                }
                else {
                    context.res = {
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                }
                context.done();
            }
        }
        async function getChange(changeId) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('Changes')
                    .findOne({ _id: mongodb.ObjectId(changeId) },
                        function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                });
                            }
                            if (docs) {
                                resolve(docs);
                            }
                            else {
                                reject({
                                    status: 404,
                                    body: {},
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                });
                            }
                        }
                    );
            });
        }

        async function getChanges(query) {
            await createEntriesDeparturesClient();
            return new Promise(function (resolve, reject) {
                entries_departures_client
                    .db(ENTRIES_DEPARTURES_DB_NAME)
                    .collection('Changes')
                    .find(query)
                    .sort({ fecha_hora: -1 })
                    .toArray(function (error, docs) {
                        if (error) {
                            reject({
                                status: 500,
                                body: error.toString(),
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            });
                        }
                        resolve(docs)
                    });
            });
        }
    }

    async function POST_change() {
        //TODO: Get person data trough userid and save it in the change data
        let change; //Base object
        var userId = null;
        var destinationAgencyId = req.body['udn_destino'];
        var destinationSubsidiaryId = req.body['sucursal_destino'];
        var originAgencyId = req.body['udn_origen'];
        var originSubsidiaryId = req.body['sucursal_origen'];
        var transportDriverId = req.body['operador_transporte'];
        var transportKindId = req.body['tipo_transporte']; //Non mandatory

        try {
            validate();
            let originAgency,
                originSubsidiary,
                destinationAgency,
                destinationSubsidiary,
                transportDriver,
                transportKind;
            if (originAgencyId) {
                originAgency = await searchAgency(originAgencyId);
            }
            if (originSubsidiaryId) {
                originSubsidiary = await searchSubsidiary(originSubsidiaryId);
            }
            if (destinationAgencyId) {
                destinationAgency = await searchAgency(destinationAgencyId);
            }
            if (destinationSubsidiaryId) {
                destinationSubsidiary = await searchSubsidiary(destinationSubsidiaryId);
            }
            if (transportDriverId) {
                transportDriver = await searchTransportDriver(transportDriverId);
            }
            if (transportKindId) {
                transportKind = await searchTransportKind(transportKindId);
            }
            let fridges = await searchAllFridges(req.body['cabinets']);

            let precedentPromises = [originAgency, destinationSubsidiary, transportDriver, transportKind, fridges, originSubsidiary, destinationAgency];

            Promise.all(precedentPromises)
                .then(async function () {
                    let date = new Date();

                    // Create a change base object.
                    change = {
                        confirmado: false,
                        descripcion_salida: req.body.descripcion,
                        fecha_hora_salida: date,
                        nombre_chofer: req.body.nombre_chofer,
                        persona: req.body.persona,
                        sucursal_origen: originSubsidiary,
                        udn_origen: originAgency,
                        sucursal_destino: destinationSubsidiary,
                        udn_destino: destinationAgency,
                        tipo_transporte: transportKind,
                        operador_transporte: transportDriver,
                        cabinets: fridges
                    };

                    let response = await writeChange();
                    //await createAllControl(response.ops[0]);
                    await updateFridges(change);

                    context.res = {
                        status: 201,
                        body: response.ops[0],
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                    context.done();
                })
                .catch(function (error) {
                    throw error;
                });

        }
        catch (error) {
            if (error.status) {
                context.res = error;
            }
            else {
                context.res = {
                    status: 500,
                    body: error.toString(),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            }
            context.done();
        }


        //Internal functions
        function validate() {
            //Cross origin and destination validation
            if (
                !(
                    (originAgencyId && destinationAgencyId && !originSubsidiaryId && !destinationSubsidiaryId)
                    || (!originAgencyId && !destinationAgencyId && originSubsidiaryId && destinationSubsidiaryId)
                )
            ) {
                //at least one
                throw {
                    status: 400,
                    body: {
                        message: 'ES-066'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }

            //Fridge array validation
            if (!req.body.cabinets) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-003'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
            if (req.body.cabinets.length === 0) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-003'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }

            //Transport driver validation
            if (req.body.nombre_chofer && transportDriverId) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-047'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
            if (!req.body.nombre_chofer && !transportDriverId) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-048'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
        }
        async function searchAgency(agencyId) {
            return new Promise(async function (resolve, reject) {
                try {
                    await createManagementClient();
                    management_client
                        .db(MANAGEMENT_DB_NAME)
                        .collection('agencies')
                        .findOne({ _id: mongodb.ObjectId(agencyId) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                if (!docs) {
                                    reject({
                                        status: 400,
                                        body: {
                                            message: 'ES-045'
                                        },
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }
            });
        }
        function searchAllFridges(fridgesId) {
            let fridgesIdArray = fridgesId.slice();
            return new Promise(async function (resolve, reject) {
                var fridgesInfoPromises = [];
                while (fridgesIdArray.length) {
                    fridgesInfoPromises.push(
                        searchFridge(
                            fridgesIdArray.pop()
                        )
                    );
                }
                try {
                    let fridgesArray = await Promise.all(fridgesInfoPromises);
                    resolve(fridgesArray);
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        async function searchFridge(fridgeInventoryNumber) {
            return new Promise(async function (resolve, reject) {
                await createManagementClient();
                try {
                    management_client
                        .db(MANAGEMENT_DB_NAME)
                        .collection('fridges')
                        .findOne({ economico: fridgeInventoryNumber },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }

                                //Validations
                                if (!docs) {
                                    //Not found fridge
                                    reject({
                                        status: 400,
                                        body: {
                                            message: 'ES-046'
                                        },
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                if (docs['establecimiento']) {
                                    //Fridge is in a store
                                    err = {
                                        status: 400,
                                        body: {
                                            message: 'ES-005'
                                        },
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    };
                                    reject(err);
                                }
                                if (docs['sucursal'] || docs['udn']) {
                                    if (docs['sucursal']) {
                                        if (docs.sucursal['_id'].toString() !== originSubsidiaryId) {
                                            err = {
                                                status: 400,
                                                body: {
                                                    message: 'ES-021'
                                                },
                                                headers: {
                                                    'Content-Type': 'application / json'
                                                }
                                            };
                                            reject(err);
                                        }
                                    }
                                    if (docs['udn']) {
                                        if (docs.udn['_id'].toString() !== originAgencyId) {
                                            err = {
                                                status: 400,
                                                body: {
                                                    message: 'ES-022'
                                                },
                                                headers: {
                                                    'Content-Type': 'application / json'
                                                }
                                            };
                                            reject(err);
                                        }
                                    }
                                }
                                //Resolve correctly if all validations are passed        
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }
            });
        }
        async function searchSubsidiary(subsidiaryId) {
            await createManagementClient();
            return new Promise(function (resolve, reject) {
                try {
                    management_client
                        .db(MANAGEMENT_DB_NAME)
                        .collection('subsidiaries')
                        .findOne({ _id: mongodb.ObjectId(subsidiaryId) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                if (!docs) {
                                    reject({
                                        status: 400,
                                        body: {
                                            message: 'ES-043'
                                        },
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                }
            });
        }
        function searchTransportDriver(transportDriverId) {
            return new Promise(async function (resolve, reject) {
                try {
                    var transportDriver = await axios.get(entries_departures + '/api/transport-driver?id=' + transportDriverId);
                    //Validations
                    if (!transportDriver.data) {
                        reject({
                            status: 400,
                            body: {
                                message: 'ES-049'
                            },
                            headers: {
                                'Content-Type': 'application / json'
                            }
                        });
                    }
                    resolve(transportDriver.data);
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }
            });
        }
        function searchTransportKind(transportKindId) {
            return new Promise(async function (resolve, reject) {
                try {
                    var transportKind = await axios.get(entries_departures + '/api/transport-kind?id=' + transportKindId);
                    //Validations
                    if (!transportKind.data) {
                        reject({
                            status: 400,
                            body: {
                                message: 'ES-050'
                            },
                            headers: {
                                'Content-Type': 'application / json'
                            }
                        });
                    }
                    resolve(transportKind.data);
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    });
                }
            });

        }
        async function writeChange() {
            return new Promise(async function (resolve, reject) {
                try {
                    await createEntriesDeparturesClient();
                    entries_departures_client
                        .db(ENTRIES_DEPARTURES_DB_NAME)
                        .collection('Changes')
                        .insertOne(change, function (error, docs) {
                            if (error) {
                                reject({
                                    status: 500,
                                    body: error.toString(),
                                    headers: {
                                        'Content-Type': 'application / json'
                                    }
                                });
                                return;
                            }
                            resolve(docs);
                        });
                }
                catch (error) {
                    throw {
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    };
                }
            });
        }
        async function updateFridges(change) {
            let fridges = change['cabinets'];
            let fridgesArray = fridges.slice();
            // let unlieverStatus = await searchUnileverStatus('0011');

            let newValues = {
                sucursal: null,
                udn: null
            };

            return new Promise(async function (resolve, reject) {
                var fridgesLocationPromises = [];
                while (fridgesArray.length) {
                    fridgesLocationPromises.push(
                        updateFridge(
                            newValues,
                            fridgesArray.pop()['_id']
                        )
                    );
                }
                try {
                    let updatedFridgesArray = await Promise.all(fridgesLocationPromises);
                    resolve(updatedFridgesArray);
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        async function updateFridge(newValues, fridgeId) {
            return new Promise(async function (resolve, reject) {
                try {
                    await createManagementClient();
                    management_client
                        .db(MANAGEMENT_DB_NAME)
                        .collection('fridges')
                        .updateOne(
                            { _id: mongodb.ObjectId(fridgeId) },
                            { $set: newValues },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                    return;
                                }
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    throw {
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    };
                }
            });
        }
    }

    async function PUT_change() {
        try {
            validate();
            //TODO: Get person data trough userid and save it in the change data
            var change; //Base object
            var userId = null;
            var changeId = req.query['id'];
            change = await getChange(changeId);
            let fridges = await searchAllFridges(req.body['cabinets']);

            let precedentPromises = [change, fridges];

            Promise.all(precedentPromises)
                .then(async function () {
                    validateDestination();
                    validateUnconfirmedChange();
                    let date = new Date();
                    let excedentFridges = getExcedentFridges(fridges, change.cabinets);
                    let missingFridges = getMissingFridges(fridges, change.cabinets);
                    // Create a change base object.
                    newValues = {
                        confirmado: true,
                        descripcion_entrada: req.body.descripcion,
                        fecha_hora_entrada: date,
                        persona: req.body.persona,
                        cabinets: fridges,
                        cabinets_excedentes: excedentFridges,
                        cabinets_faltantes: missingFridges
                    };

                    await updateChange(newValues, change['_id']);
                    await updateFridges(change);
                    let response = await getChange(changeId);
                    context.res = {
                        status: 200,
                        body: response,
                        headers: {
                            "Content-Type": "application/json"
                        }
                    }
                    context.done();
                })
                .catch(function (error) {
                    throw error;
                });

        }
        catch (error) {
            if (error.status) {
                context.res = error;
            }
            else {
                context.res = {
                    status: 500,
                    body: error.toString(),
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            }
            context.done();
        }


        //Internal functions
        function validate() {
            //No id was provided
            if (!req.query) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-069'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
            if (!req.query['id']) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-069'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
            //Fridge array validation
            if (!req.body.cabinets) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-003'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
            if (req.body.cabinets.length === 0) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-003'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
        }
        function validateDestination() {
            //Destination validation
            if (change['sucursal_destino']) {
                if (change['sucursal_destino']._id.toString() !== req.body['sucursal_destino']) {
                    throw {
                        status: 400,
                        body: {
                            message: 'ES-067'
                        },
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    };
                }
            }
            if (change['udn_destino']) {
                if (change['udn_destino']._id.toString() !== req.body['udn_destino']) {
                    throw {
                        status: 400,
                        body: {
                            message: 'ES-068'
                        },
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    };
                }
            }
        }
        function validateUnconfirmedChange() {
            if (change.confirmado) {
                throw {
                    status: 400,
                    body: {
                        message: 'ES-070'
                    },
                    headers: {
                        'Content-Type': 'application / json'
                    }
                };
            }
        }
        function searchAllFridges(fridgesId) {
            let fridgesIdArray = fridgesId.slice();
            return new Promise(async function (resolve, reject) {
                var fridgesInfoPromises = [];
                while (fridgesIdArray.length) {
                    fridgesInfoPromises.push(
                        searchFridge(
                            fridgesIdArray.pop()
                        )
                    );
                }
                try {
                    let fridgesArray = await Promise.all(fridgesInfoPromises);
                    resolve(fridgesArray);
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        async function searchFridge(fridgeInventoryNumber) {
            return new Promise(async function (resolve, reject) {
                try {
                    await createManagementClient();
                    management_client
                        .db(MANAGEMENT_DB_NAME)
                        .collection('fridges')
                        .findOne({ economico: fridgeInventoryNumber },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                    //return;
                                }

                                //Validations
                                if (!docs) {
                                    //Not found fridge
                                    reject({
                                        status: 400,
                                        body: {
                                            message: 'ES-046'
                                        },
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                    //return;
                                }
                                //Resolve correctly if all validations are passed        
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            "Content-Type": "application/json"
                        }
                    })
                }
            });
        }
        async function updateChange(newValues, changeId) {
            return new Promise(async function (resolve, reject) {
                try {
                    await createEntriesDeparturesClient();
                    management_client
                        .db(ENTRIES_DEPARTURES_DB_NAME)
                        .collection('Changes')
                        .updateOne(
                            { _id: mongodb.ObjectId(changeId) },
                            { $set: newValues },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    });
                }
            });
        }
        async function updateFridges(change) {
            let fridges = change['cabinets'];
            let fridgesArray = fridges.slice();

            let newValues = {
                sucursal: null,
                udn: null
            };

            if (change.sucursal_destino) {
                newValues.sucursal = change['sucursal_destino'];
            }
            if (change.udn_destino) {
                newValues.udn = change['udn_destino'];
            }

            return new Promise(async function (resolve, reject) {
                var fridgesLocationPromises = [];
                while (fridgesArray.length) {
                    fridgesLocationPromises.push(
                        updateFridge(
                            newValues,
                            fridgesArray.pop()['_id']
                        )
                    );
                }
                try {
                    let updatedFridgesArray = await Promise.all(fridgesLocationPromises);
                    resolve(updatedFridgesArray);
                }
                catch (error) {
                    reject(error);
                }
            });
        }
        async function updateFridge(newValues, fridgeId) {
            return new Promise(async function (resolve, reject) {
                try {
                    await createManagementClient();
                    management_client
                        .db(MANAGEMENT_DB_NAME)
                        .collection('fridges')
                        .updateOne(
                            { _id: mongodb.ObjectId(fridgeId) },
                            { $set: newValues },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application / json'
                                        }
                                    });
                                }
                                resolve(docs);
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    });
                }
            });
        }
        async function getChange(changeId) {
            return new Promise(async function (resolve, reject) {
                try {
                    await createEntriesDeparturesClient();
                    entries_departures_client
                        .db(ENTRIES_DEPARTURES_DB_NAME)
                        .collection('Changes')
                        .findOne({ _id: mongodb.ObjectId(changeId) },
                            function (error, docs) {
                                if (error) {
                                    reject({
                                        status: 500,
                                        body: error.toString(),
                                        headers: {
                                            'Content-Type': 'application/json'
                                        }
                                    });
                                }
                                if (docs) {
                                    resolve(docs);
                                }
                                else {
                                    reject({
                                        status: 404,
                                        body: {},
                                        headers: {
                                            "Content-Type": "application/json"
                                        }
                                    });
                                }
                            }
                        );
                }
                catch (error) {
                    reject({
                        status: 500,
                        body: error.toString(),
                        headers: {
                            'Content-Type': 'application / json'
                        }
                    });
                }
            });
        }
        function getExcedentFridges(fridges, sentFridges) {
            let excedentFridges = [];
            for (let i = 0; i < fridges.length; i++) {
                if (!sentFridges.find(
                    function (fridge) {
                        return fridge['_id'].toString() === fridges[i]._id.toString();
                    }
                )) {
                    excedentFridges.push(fridges[i]);
                }
            }
            return excedentFridges;
        }
        function getMissingFridges(fridges, sentFridges) {
            let missingFridges = [];
            for (let i = 0; i < sentFridges.length; i++) {
                if (!fridges.find(
                    function (fridge) {
                        return fridge['_id'].toString() === sentFridges[i]._id.toString();
                    }
                )) {
                    missingFridges.push(fridges[i]);
                }
            }
            return missingFridges;
        }
    }

    //Internal global functions 
    function createEntriesDeparturesClient() {
        return new Promise(function (resolve, reject) {
            if (!entries_departures_client) {
                mongodb.MongoClient.connect(connection_EntriesDepartures, function (error, _entries_departures_client) {
                    if (error) {
                        reject(error);
                    }
                    entries_departures_client = _entries_departures_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    function createManagementClient() {
        return new Promise(function (resolve, reject) {
            if (!management_client) {
                mongodb.MongoClient.connect(connection_Management, function (error, _management_client) {
                    if (error) {
                        reject(error);
                    }
                    management_client = _management_client;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }

};