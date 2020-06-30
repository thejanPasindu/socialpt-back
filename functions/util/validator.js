const { user } = require("firebase-functions/lib/providers/auth");

const isEmpty = (string) => {
    if (string.trim() == '') return true;
    return false;
};

exports.singupDataValidator = (data) =>{
    let errors = {};

    if (isEmpty(data.password)) errors.password = 'Must not be empty';
    if (isEmpty(data.confrimPassword)) errors.password = 'Must not be empty';
    if (isEmpty(data.handle)) errors.handle = 'Must not be empty';
    if (data.password != data.confrimPassword) errors.password = 'Password does not match';

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
};

exports.loginValidator = (data) =>{
    let errors = {};

    if (isEmpty(data.email)) errors.email = "Must not be empty";
    if (isEmpty(data.password)) errors.password = "Must not be empty";

    return {
        errors,
        valid: Object.keys(errors).length === 0 ? true : false
    }
}

exports.redusUserDetaild = (data) =>{

    let userDetails ={};

    if(!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
    if(!isEmpty(data.website.trim())) userDetails.website = data.website;
    if(!isEmpty(data.location.trim())) userDetails.location = data.location;

    return userDetails;
};