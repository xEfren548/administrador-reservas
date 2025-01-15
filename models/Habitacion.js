const mongoose = require("mongoose");

const generalFeaturesSchema = new mongoose.Schema({
    satelliteTV: { type: Boolean, default: false },
    disabledAccessible: { type: Boolean, default: false },
    iron: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    allergyFriendlyRooms: { type: Boolean, default: false },
    solarium: { type: Boolean, default: false },
    mosquitoNet: { type: Boolean, default: false },
    airConditioningInMainRooms: { type: Boolean, default: false },
    connectingRooms: { type: Boolean, default: false },
    airConditioningThroughoutProperty: { type: Boolean, default: false },
    tiledFloorOrMarble: { type: Boolean, default: false },
    fireplace: { type: Boolean, default: false },
    ironingFacilities: { type: Boolean, default: false },
    hardwoodOrParquetFloors: { type: Boolean, default: false },
    noSmokingAllowed: { type: Boolean, default: false },
    wardrobe: { type: Boolean, default: false },
    carpetedFloor: { type: Boolean, default: false },
    expressCheckInCheckOut: { type: Boolean, default: false },
    soundproofing: { type: Boolean, default: false },
    telephone: { type: Boolean, default: false },
    terrace: { type: Boolean, default: false },
    balcony: { type: Boolean, default: false },
    buffetBreakfast: { type: Boolean, default: false },
    safeDepositBox: { type: Boolean, default: false },
    wifi: { type: Boolean, default: false },
    breakfastInRoom: { type: Boolean, default: false },
    heating: { type: Boolean, default: false },
    extraLongBeds: { type: Boolean, default: false },
    roomService: { type: Boolean, default: false },
    fan: { type: Boolean, default: false },
    dressingRoom: { type: Boolean, default: false },
    smokers: { type: Boolean, default: false },
    grill: { type: Boolean, default: false },
});

const viewsSchema = new mongoose.Schema({
    cityView: { type: Boolean, default: false },
    mountainView: { type: Boolean, default: false },
    poolView: { type: Boolean, default: false },
    landmarkView: { type: Boolean, default: false },
    gardenView: { type: Boolean, default: false },
    lakeView: { type: Boolean, default: false },
    seaView: { type: Boolean, default: false },
    patioView: { type: Boolean, default: false },
    riverView: { type: Boolean, default: false }
});

const activitiesSchema = new mongoose.Schema({
    turkishBath: { type: Boolean, default: false },
    gym: { type: Boolean, default: false },
    thermalBaths: { type: Boolean, default: false },
    minigolf: { type: Boolean, default: false },
    canoeing: { type: Boolean, default: false },
    spa: { type: Boolean, default: false },
    casino: { type: Boolean, default: false },
    library: { type: Boolean, default: false },
    horseRiding: { type: Boolean, default: false },
    cycling: { type: Boolean, default: false },
    billiards: { type: Boolean, default: false },
    bowling: { type: Boolean, default: false },
    gameRoom: { type: Boolean, default: false },
    barbecueFacilities: { type: Boolean, default: false },
    diving: { type: Boolean, default: false },
    fishing: { type: Boolean, default: false },
    jacuzzi: { type: Boolean, default: false },
    heatedPool: { type: Boolean, default: false },
    sauna: { type: Boolean, default: false },
    karaoke: { type: Boolean, default: false },
    indoorPool: { type: Boolean, default: false },
    outdoorPool: { type: Boolean, default: false },
    snorkeling: { type: Boolean, default: false },
    privatePool: { type: Boolean, default: false },
    childrensPlayground: { type: Boolean, default: false },
    hiking: { type: Boolean, default: false },
    masseuse: { type: Boolean, default: false },
    golfCourse: { type: Boolean, default: false },
});

const parkingSchema = new mongoose.Schema({
    paidParking: { type: Boolean, default: false },
    publicParking: { type: Boolean, default: false },
    freeParking: { type: Boolean, default: false },
    privateParking: { type: Boolean, default: false }
});

const restroomFeaturesSchema = new mongoose.Schema({
    bathrobe: { type: Boolean, default: false },
    bidet: { type: Boolean, default: false },
    freeToiletries: { type: Boolean, default: false },
    additionalToilet: { type: Boolean, default: false },
    sharedToilet: { type: Boolean, default: false },
    sauna: { type: Boolean, default: false },
    bathtub: { type: Boolean, default: false },
    hairdryer: { type: Boolean, default: false },
    jacuzzi: { type: Boolean, default: false },
    shower: { type: Boolean, default: false },
    additionalBathroom: { type: Boolean, default: false },
    slippers: { type: Boolean, default: false },
    sharedBathroom: { type: Boolean, default: false },
    designerBathroom: { type: Boolean, default: false },
    privateBathroom: { type: Boolean, default: false }
});

const kitchenSchema = new mongoose.Schema({
    minibar: { type: Boolean, default: false },
    barbecue: { type: Boolean, default: false },
    blender: { type: Boolean, default: false },
    refrigerator: { type: Boolean, default: false },
    electricKettle: { type: Boolean, default: false },
    oven: { type: Boolean, default: false },
    stove: { type: Boolean, default: false },
    ceramicCooktop: { type: Boolean, default: false },
    teapot: { type: Boolean, default: false },
    coffeeMaker: { type: Boolean, default: false },
    toaster: { type: Boolean, default: false },
    washingMachine: { type: Boolean, default: false },
    dryer: { type: Boolean, default: false },
    dishwasher: { type: Boolean, default: false },
    cookingUtensils: { type: Boolean, default: false },
    kitchenArea: { type: Boolean, default: false },
    diningArea: { type: Boolean, default: false },
    fridge: { type: Boolean, default: false },
    microwave: { type: Boolean, default: false },
});

const sportSchema = new mongoose.Schema({
    paddleTennis: { type: Boolean, default: false },
    gym: { type: Boolean, default: false },
    basketballCourt: { type: Boolean, default: false },
    darts: { type: Boolean, default: false },
    windsurfing: { type: Boolean, default: false },
    skiSchool: { type: Boolean, default: false },
    footballField: { type: Boolean, default: false },
    skiing: { type: Boolean, default: false },
    pingPong: { type: Boolean, default: false },
    squash: { type: Boolean, default: false },
    indoorFootballCourt: { type: Boolean, default: false },
    tennisCourt: { type: Boolean, default: false },
});

const livingRoomSchema = new mongoose.Schema({
    doubleSofaBed: { type: Boolean, default: false },
    individualSofaBed: { type: Boolean, default: false },
    tv: { type: Boolean, default: false },
    satelliteTV: { type: Boolean, default: false },
    snackBar: { type: Boolean, default: false }
});

//--------------------------------------------------

const propertyDetailsSchema = new mongoose.Schema({
    accomodationType: {
        type: String,
        ////required: true
    },
    name: {
        type: String,
        //required: true,
        unique: true
    },
    phoneNumber: {
        type: String,
        //required: true
    },
    email: {
        type: String,
        //required: true
    },
    website: {
        type: String,
        //required: true
    },
    minOccupancy: {
        type: Number,
        //required: true
    },
    maxOccupancy: {
        type: Number,
        //required: true
    },
    tourLicense: {
        type: String,
        //required: true
    }
});

const accommodationFeaturesSchema = new mongoose.Schema({
    generalFeatures: generalFeaturesSchema,
    views: viewsSchema,
    activities: activitiesSchema,
    parking: parkingSchema,
    restroomFeatures: restroomFeaturesSchema,
    kitchen: kitchenSchema,
    sport: sportSchema,
    livingRoom: livingRoomSchema
});

const additionalInfoSchema = new mongoose.Schema({
    nBeds: {
        type: Number,
        //required: true
    },
    nRestrooms: {
        type: Number,
        //required: true
    },
    bedroomSize: {
        type: Number,
        //required: true
    },
    capacity: {
        type: Number,
        //required: true
    },
    extraCleaningCost: {
        type: Number,
        //required: true
    }
});

const locationSchema = new mongoose.Schema({
    state: {
        type: String,
        //required: true
    },
    population: {
        type: String,
        //required: true
    },
    address: {
        type: String,
    },
    addressNumber: {
        type: Number,
        //required: true
    },
    postalCode: {
        type: Number,
        //required: true
    },
    latitude: {
        type: Number,
        //required: true
    },
    longitude: {
        type: Number,
        //required: true
    },
    weatherWidget: {
        type: String,
        //required: true
    },
});

const othersSchema = new mongoose.Schema({
    basePrice: {
        type: Number,
        //required: true
    },
    basePrice2nights: {
        type: Number,
        //required: true
    },
    baseCost: {
        type: Number,
        //required: true
    },
    baseCost2nights: {
        type: Number,
        //required: true
    },
    arrivalTime: {
        type: Date,
        //required: true
    },
    departureTime: {
        type: Date,
        //required: true
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        //required: true,
        ref: 'Usuario'
    },
    janitor: {
        type: mongoose.Schema.Types.ObjectId,
        //required: true,
        ref: 'Usuario'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Usuario'
    },
    investors: {
        type: [{type: mongoose.Schema.Types.ObjectId, ref: 'usuarios'}]
    }
});

//--------------------------------------------------

const preSchema = new mongoose.Schema({
    propertyDetails: propertyDetailsSchema,
    accommodationFeatures: accommodationFeaturesSchema,
    additionalInfo: additionalInfoSchema,
    location: locationSchema,
    accomodationDescription: {
        type: String,
        //required: true
    },
    legalNotice: {
        type: String,
        //required: true
    },
    others: othersSchema,
    images: {
        type: [String],
        //required: true
    },
    files: {
        type: [String],
        //required: true
    }
});

// const habitacionesSchema = new mongoose.Schema({
//     resources: [preSchema],
// });

module.exports = mongoose.model('habitaciones', preSchema);
